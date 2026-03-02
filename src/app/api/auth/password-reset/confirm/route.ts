import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { hashResetToken } from '@/lib/password-reset';

const confirmSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8)
});

export async function POST(req: Request) {
  try {
    const payload = confirmSchema.parse(await req.json());
    const tokenHash = hashResetToken(payload.token);

    const tokenRes = await db.query(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > now()
       LIMIT 1`,
      [tokenHash]
    );

    if ((tokenRes.rowCount ?? 0) === 0) {
      return NextResponse.json({ ok: false, error: 'Reset token is invalid or expired.' }, { status: 400 });
    }

    const tokenRow = tokenRes.rows[0] as { id: string; user_id: string };
    const passwordHash = await hashPassword(payload.password);

    await db.query('BEGIN');
    try {
      await db.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
        passwordHash,
        tokenRow.user_id
      ]);

      await db.query('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [
        tokenRow.user_id
      ]);

      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

    return NextResponse.json({ ok: true, message: 'Password has been reset successfully.' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Password reset failed' },
      { status: 400 }
    );
  }
}
