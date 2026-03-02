import Stripe from 'stripe';
import { db } from '@/lib/db';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

export function stripeUrls() {
  const root = baseUrl();
  return {
    successUrl: `${root}/dashboard`,
    cancelUrl: `${root}/dashboard`,
    returnUrl: `${root}/dashboard`
  };
}

export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const subRes = await db.query(
    'SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1 AND stripe_customer_id IS NOT NULL LIMIT 1',
    [userId]
  );

  const existingCustomer = subRes.rows[0]?.stripe_customer_id as string | undefined;
  if (existingCustomer) {
    return existingCustomer;
  }

  const userRes = await db.query('SELECT email FROM users WHERE id = $1 LIMIT 1', [userId]);
  const email = userRes.rows[0]?.email as string | undefined;
  if (!email) {
    throw new Error('User email not found.');
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId }
  });

  await db.query(
    `INSERT INTO subscriptions (user_id, stripe_customer_id, status)
     VALUES ($1, $2, 'trial')
     ON CONFLICT (user_id)
     DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id, updated_at = now()`,
    [userId, customer.id]
  );

  return customer.id;
}
