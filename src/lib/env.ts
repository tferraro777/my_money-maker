const isProduction = process.env.NODE_ENV === 'production';

function readEnv(name: string): string {
  return String(process.env[name] ?? '').trim();
}

function requireEnv(name: string, context: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`[env:${context}] Missing required env var: ${name}`);
  }
  return value;
}

function requireOneOfEnv(names: string[], context: string): string {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  throw new Error(`[env:${context}] Missing required env var: one of ${names.join(', ')}`);
}

export function requireDatabaseUrl(): string {
  return requireEnv('DATABASE_URL', 'database');
}

export function requireAuthSecret(): string {
  const secret = requireEnv('AUTH_SECRET', 'auth');
  if (secret.length < 32) {
    throw new Error('[env:auth] AUTH_SECRET must be at least 32 characters.');
  }
  return secret;
}

export function requireOpenAiKey(): string {
  return requireEnv('OPENAI_API_KEY', 'openai');
}

export function requireBaseUrl(): string {
  const baseUrl = requireEnv('NEXT_PUBLIC_BASE_URL', 'base-url');
  if (isProduction && baseUrl.includes('localhost')) {
    throw new Error('[env:base-url] NEXT_PUBLIC_BASE_URL cannot be localhost in production.');
  }
  return baseUrl;
}

export function requireStripeKey(): string {
  return requireEnv('STRIPE_SECRET_KEY', 'stripe');
}

export function requireStripeWebhookSecret(): string {
  return requireEnv('STRIPE_WEBHOOK_SECRET', 'stripe-webhook');
}

export function requireStripePriceId(): string {
  return requireEnv('STRIPE_PRICE_ID_MONTHLY', 'stripe-checkout');
}

export function requireEmailConfig(): { from: string; apiKey: string } {
  const from = requireEnv('EMAIL_FROM', 'email');
  const apiKey = requireEnv('EMAIL_PROVIDER_API_KEY', 'email');
  return { from, apiKey };
}

export function requireIngestionSecret(): string {
  return requireOneOfEnv(['INGESTION_CRON_SECRET', 'CRON_SECRET'], 'ingestion');
}

export function assertNoDevUserIdInProduction(): void {
  if (isProduction && readEnv('DEV_USER_ID')) {
    throw new Error('[env:auth] DEV_USER_ID must not be set in production.');
  }
}

export function validatePushConfig(): void {
  const publicKey = readEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY');
  const privateKey = readEnv('VAPID_PRIVATE_KEY');
  const pushEnabled = publicKey.length > 0 || privateKey.length > 0;
  if (pushEnabled && (!publicKey || !privateKey)) {
    throw new Error(
      '[env:push] Push keys must be configured together: NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.'
    );
  }
}

export function validateCoreProductionEnv(): void {
  if (!isProduction) return;

  requireDatabaseUrl();
  requireAuthSecret();
  requireOpenAiKey();
  requireBaseUrl();
  requireStripeKey();
  requireStripeWebhookSecret();
  requireStripePriceId();
  requireEmailConfig();
  requireIngestionSecret();
  assertNoDevUserIdInProduction();
  validatePushConfig();
}
