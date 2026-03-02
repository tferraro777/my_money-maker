import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  generateResetToken,
  hashResetToken,
  PASSWORD_RESET_TTL_MINUTES,
  resetExpiryDate
} from '@/lib/password-reset';
import { sendEmail } from '@/lib/email-sender';
import { passwordResetEmailTemplate } from '@/lib/email-templates';

const requestSchema = z.object({
  email: z.string().email()
});

export async function POST(req: Request) {
  try {
    const payload = requestSchema.parse(await req.json());
    const email = payload.email.toLowerCase();

    const userRes = await db.query(
      'SELECT id, email, is_banned FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if ((userRes.rowCount ?? 0) > 0) {
      const user = userRes.rows[0] as { id: string; email: string; is_banned: boolean };
      if (!user.is_banned) {
        const token = generateResetToken();
        const tokenHash = hashResetToken(token);
        const expiresAt = resetExpiryDate();

        await db.query(
          `DELETE FROM password_reset_tokens
           WHERE user_id = $1 AND used_at IS NULL`,
          [user.id]
        );

        await db.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [user.id, tokenHash, expiresAt.toISOString()]
        );

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const resetUrl = `${baseUrl}/auth/reset?token=${token}`;

        const template = passwordResetEmailTemplate(resetUrl);
        const emailResult = await sendEmail({
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text
        });

        if (!emailResult.sent) {
          console.log(`[password-reset-dev-fallback] ${resetUrl}`);
        }

        if (process.env.NODE_ENV !== 'production') {
          return NextResponse.json({
            ok: true,
            message: `If the account exists, a reset link has been sent.`,
            devResetUrl: resetUrl,
            expiresInMinutes: PASSWORD_RESET_TTL_MINUTES
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'If the account exists, a reset link has been sent.'
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Password reset request failed' },
      { status: 400 }
    );
  }
}
