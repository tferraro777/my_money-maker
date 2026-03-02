import crypto from 'crypto';

export const EMAIL_VERIFICATION_TTL_HOURS = 72;

export function generateEmailVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashEmailVerificationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function emailVerificationExpiryDate(): Date {
  return new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000);
}
