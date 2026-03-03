import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { requireAuthSecret } from '@/lib/env';

const COOKIE_NAME = 'mmm_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function secretKey(): Uint8Array {
  const secret = requireAuthSecret();
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const verified = await jwtVerify(token, secretKey());
    const userId = String(verified.payload.sub || '');
    const email = String(verified.payload.email || '');
    if (!userId) return null;
    return { userId, email };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
}

export async function getSessionUserId(): Promise<string | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const parsed = await verifySessionToken(token);
    return parsed?.userId ?? null;
  } catch {
    return null;
  }
}
