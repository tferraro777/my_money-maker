import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { getOrCreateStripeCustomer, stripe, stripeUrls } from '@/lib/stripe';
import { requireStripePriceId } from '@/lib/env';

export async function POST() {
  try {
    const userId = await requireUserId();

    const priceId = requireStripePriceId();

    const customerId = await getOrCreateStripeCustomer(userId);
    const urls = stripeUrls();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
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
