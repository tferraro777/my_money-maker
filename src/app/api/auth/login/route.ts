import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/password';
import { createSessionToken, setSessionCookie } from '@/lib/session';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(req: Request) {
  try {
    const payload = loginSchema.parse(await req.json());

    const userRes = await db.query(
      'SELECT id, email, password_hash, is_banned, email_verified_at FROM users WHERE email = $1 LIMIT 1',
      [payload.email.toLowerCase()]
    );

    if ((userRes.rowCount ?? 0) === 0) {
      return NextResponse.json({ ok: false, error: 'Invalid email or password.' }, { status: 401 });
    }

    const user = userRes.rows[0] as {
      id: string;
      email: string;
      password_hash: string | null;
      is_banned: boolean;
      email_verified_at?: string | null;
    };

    if (user.is_banned) {
      return NextResponse.json({ ok: false, error: 'Account is blocked.' }, { status: 403 });
    }

    if (!user.password_hash) {
      return NextResponse.json({ ok: false, error: 'Password login is not available for this account.' }, { status: 401 });
    }

    const valid = await verifyPassword(payload.password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Invalid email or password.' }, { status: 401 });
    }

    const token = await createSessionToken(user.id, user.email);
    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email },
      emailVerified: !!user.email_verified_at
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Login failed' },
      { status: 400 }
    );
  }
}
