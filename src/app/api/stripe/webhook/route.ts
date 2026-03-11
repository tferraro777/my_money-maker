import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { requireStripeKey, requireStripeWebhookSecret } from '@/lib/env';

export const runtime = 'nodejs';

const stripe = new Stripe(requireStripeKey());

type AppSubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'incomplete';

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  if (typeof legacy === 'string') return legacy;

  const nested = (
    invoice as Stripe.Invoice & { parent?: { subscription_details?: { subscription?: string | null } } }
  ).parent?.subscription_details?.subscription;

  return nested ?? null;
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): AppSubscriptionStatus {
  if (status === 'trialing') return 'trial';
  if (status === 'active') return 'active';
  if (status === 'past_due' || status === 'unpaid' || status === 'paused') return 'past_due';
  if (status === 'canceled') return 'canceled';
  return 'incomplete';
}

async function resolveUserIdFromSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const metadataUserId = sub.metadata?.user_id;
  if (metadataUserId) return metadataUserId;

  const bySubId = await db.query(
    `SELECT user_id
     FROM subscriptions
     WHERE stripe_subscription_id = $1
     LIMIT 1`,
    [sub.id]
  );
  if ((bySubId.rowCount ?? 0) > 0) return String(bySubId.rows[0].user_id);

  const byCustomer = await db.query(
    `SELECT user_id
     FROM subscriptions
     WHERE stripe_customer_id = $1
     LIMIT 1`,
    [String(sub.customer)]
  );
  if ((byCustomer.rowCount ?? 0) > 0) return String(byCustomer.rows[0].user_id);

  return null;
}

async function upsertSubscriptionFromStripe(sub: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserIdFromSubscription(sub);
  if (!userId) {
    console.warn('[stripe:webhook] Unable to resolve user_id for subscription event', {
      subscriptionId: sub.id,
      customerId: String(sub.customer),
      status: sub.status
    });
    return;
  }

  const normalizedStatus = mapSubscriptionStatus(sub.status);
  const periodEnd = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end ?? 0;

  await db.query(
    `INSERT INTO subscriptions (
       user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id,
       status, current_period_end, canceled_at
     )
     VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7)
     ON CONFLICT (user_id)
     DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       stripe_price_id = EXCLUDED.stripe_price_id,
       status = EXCLUDED.status,
       current_period_end = EXCLUDED.current_period_end,
       canceled_at = EXCLUDED.canceled_at,
       updated_at = now()`,
    [
      userId,
      String(sub.customer),
      sub.id,
      sub.items.data[0]?.price.id ?? null,
      normalizedStatus,
      periodEnd,
      normalizedStatus === 'canceled' ? new Date().toISOString() : null
    ]
  );
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== 'subscription') return;

  const userId = session.client_reference_id || session.metadata?.user_id || null;
  if (!userId) return;

  await db.query(
    `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status)
     VALUES ($1, $2, $3, 'trial')
     ON CONFLICT (user_id)
     DO UPDATE SET
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
       updated_at = now()`,
    [userId, session.customer ? String(session.customer) : null, session.subscription ? String(session.subscription) : null]
  );
}

export async function POST(req: Request) {
  let eventIdForFailureLog: string | null = null;
  let webhookEventRowId: string | null = null;

  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json({ ok: false, error: 'Missing Stripe-Signature header' }, { status: 400 });
    }

    // IMPORTANT: raw body must be unmodified for Stripe signature verification.
    const buf = Buffer.from(await req.arrayBuffer());
    const secret = requireStripeWebhookSecret();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(buf, signature, secret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid Stripe signature';
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    eventIdForFailureLog = event.id;

    // Store full payload (as JSON string) for idempotency + auditing.
    const payloadString = buf.toString('utf8');

    const inserted = await db.query(
      `INSERT INTO stripe_webhook_events (
         stripe_event_id, event_type, livemode, payload, processing_status, error_message, processed_at
       ) VALUES ($1, $2, $3, $4::jsonb, 'processing', NULL, NULL)
       ON CONFLICT (stripe_event_id)
       DO UPDATE SET
         payload = EXCLUDED.payload,
         event_type = EXCLUDED.event_type,
         livemode = EXCLUDED.livemode,
         processing_status = CASE
           WHEN stripe_webhook_events.processing_status = 'failed' THEN 'processing'
           ELSE stripe_webhook_events.processing_status
         END,
         error_message = CASE
           WHEN stripe_webhook_events.processing_status = 'failed' THEN NULL
           ELSE stripe_webhook_events.error_message
         END,
         processed_at = CASE
           WHEN stripe_webhook_events.processing_status = 'failed' THEN NULL
           ELSE stripe_webhook_events.processed_at
         END
       RETURNING id, processing_status`,
      [event.id, event.type, event.livemode, payloadString]
    );

    webhookEventRowId = String(inserted.rows[0]?.id ?? '');

    // Duplicate delivery of an already-processed event should stay a no-op.
    if (inserted.rows[0]?.processing_status !== 'processing') {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      await upsertSubscriptionFromStripe(event.data.object as Stripe.Subscription);
    } else if (event.type === 'customer.subscription.deleted') {
      await upsertSubscriptionFromStripe(event.data.object as Stripe.Subscription);
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (subscriptionId) {
        await db.query(
          `UPDATE subscriptions
           SET status = 'past_due', updated_at = now()
           WHERE stripe_subscription_id = $1`,
          [subscriptionId]
        );
      }
    } else if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoiceSubscriptionId(invoice);
      if (subscriptionId) {
        await db.query(
          `UPDATE subscriptions
           SET status = 'active', updated_at = now()
           WHERE stripe_subscription_id = $1`,
          [subscriptionId]
        );
      }
    } else {
      await db.query(
        `UPDATE stripe_webhook_events
         SET processing_status = 'ignored',
             processed_at = now(),
             error_message = NULL
         WHERE id = $1`,
        [webhookEventRowId]
      );
    }

    await db.query(
      `UPDATE stripe_webhook_events
       SET processing_status = 'processed',
           processed_at = now(),
           error_message = NULL
       WHERE id = $1`,
      [webhookEventRowId]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook failed';
    console.error('[stripe:webhook] Processing failed', { error: message, eventId: eventIdForFailureLog });

    if (webhookEventRowId) {
      try {
        await db.query(
          `UPDATE stripe_webhook_events
           SET processing_status = 'failed',
               error_message = $2,
               processed_at = NULL
           WHERE id = $1`,
          [webhookEventRowId, String(message).slice(0, 2000)]
        );
      } catch {
        // ignore secondary failure
      }
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
