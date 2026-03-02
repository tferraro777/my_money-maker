import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { getOrCreateStripeCustomer, stripe, stripeUrls } from '@/lib/stripe';

export async function POST() {
  try {
    const userId = await requireUserId();

    if (!process.env.STRIPE_PRICE_ID_MONTHLY) {
      return NextResponse.json({ ok: false, error: 'Missing STRIPE_PRICE_ID_MONTHLY config.' }, { status: 500 });
    }

    const customerId = await getOrCreateStripeCustomer(userId);
    const urls = stripeUrls();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID_MONTHLY, quantity: 1 }],
      success_url: urls.successUrl,
      cancel_url: urls.cancelUrl,
      subscription_data: {
        metadata: {
          user_id: userId
        }
      }
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 400 }
    );
  }
}
