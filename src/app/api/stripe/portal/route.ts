import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe, stripeUrls } from '@/lib/stripe';

export async function POST() {
  try {
    const userId = await requireUserId();

    const subRes = await db.query(
      'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1 AND stripe_customer_id IS NOT NULL LIMIT 1',
      [userId]
    );
    const customerId = subRes.rows[0]?.stripe_customer_id as string | undefined;

    if (!customerId) {
      return NextResponse.json({ ok: false, error: 'No Stripe customer found for this user yet.' }, { status: 400 });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: stripeUrls().returnUrl
    });

    return NextResponse.json({ ok: true, url: portal.url });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create billing portal session' },
      { status: 400 }
    );
  }
}
