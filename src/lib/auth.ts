import { headers } from 'next/headers';
import { getSessionUserId } from '@/lib/session';
import { assertNoDevUserIdInProduction } from '@/lib/env';

export async function getOptionalUserId(): Promise<string | null> {
  assertNoDevUserIdInProduction();

  const sessionUserId = await getSessionUserId();
  if (sessionUserId) return sessionUserId;

  if (process.env.NODE_ENV !== 'production') {
    // Backward-compatible local overrides for internal testing tools.
    const headerStore = headers();
    const headerUserId = headerStore.get('x-user-id');
    if (headerUserId) return headerUserId;

    if (process.env.DEV_USER_ID) {
      return process.env.DEV_USER_ID;
    }
  }

  return null;
}

export async function requireUserId(): Promise<string> {
  const userId = await getOptionalUserId();
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}
