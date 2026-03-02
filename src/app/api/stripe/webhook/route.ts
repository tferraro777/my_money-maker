import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, error: 'Missing webhook signature config' }, { status: 400 });
    }

    const rawBody = await req.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;

      if (userId) {
        await db.query(
          `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, status, current_period_end)
           VALUES ($1, $2, $3, $4, $5, to_timestamp($6))
           ON CONFLICT (user_id)
           DO UPDATE SET
             stripe_customer_id = EXCLUDED.stripe_customer_id,
             stripe_subscription_id = EXCLUDED.stripe_subscription_id,
             stripe_price_id = EXCLUDED.stripe_price_id,
             status = EXCLUDED.status,
             current_period_end = EXCLUDED.current_period_end,
             updated_at = now()`,
          [
            userId,
            String(sub.customer),
            sub.id,
            sub.items.data[0]?.price.id ?? null,
            sub.status,
            (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end ?? 0
          ]
        );
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;

      if (userId) {
        await db.query(
          `UPDATE subscriptions
           SET status = 'canceled', canceled_at = now(), updated_at = now()
           WHERE user_id = $1`,
          [userId]
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Webhook failed' },
      { status: 400 }
    );
  }
}
