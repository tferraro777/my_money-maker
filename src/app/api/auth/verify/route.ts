import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashEmailVerificationToken } from '@/lib/email-verification';

const verifySchema = z.object({
  token: z.string().min(20)
});

export async function POST(req: Request) {
  try {
    const payload = verifySchema.parse(await req.json());
    const tokenHash = hashEmailVerificationToken(payload.token);

    const tokenRes = await db.query(
      `SELECT id, user_id
       FROM email_verification_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > now()
       LIMIT 1`,
      [tokenHash]
    );

    if ((tokenRes.rowCount ?? 0) === 0) {
      return NextResponse.json({ ok: false, error: 'Verification token is invalid or expired.' }, { status: 400 });
    }

    const row = tokenRes.rows[0] as { id: string; user_id: string };

    await db.query('BEGIN');
    try {
      await db.query('UPDATE users SET email_verified_at = now(), updated_at = now() WHERE id = $1', [row.user_id]);
      await db.query('UPDATE email_verification_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [
        row.user_id
      ]);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

    return NextResponse.json({ ok: true, message: 'Email verified successfully.' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Email verification failed' },
      { status: 400 }
    );
  }
}
