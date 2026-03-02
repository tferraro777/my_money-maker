import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireUserId } from '@/lib/auth';
import {
  emailVerificationExpiryDate,
  generateEmailVerificationToken,
  hashEmailVerificationToken,
  EMAIL_VERIFICATION_TTL_HOURS
} from '@/lib/email-verification';
import { sendEmail } from '@/lib/email-sender';
import { verificationEmailTemplate } from '@/lib/email-templates';

export async function POST() {
  try {
    const userId = await requireUserId();

    const userRes = await db.query('SELECT email, email_verified_at, is_banned FROM users WHERE id = $1 LIMIT 1', [userId]);
    if ((userRes.rowCount ?? 0) === 0) {
      return NextResponse.json({ ok: false, error: 'User not found.' }, { status: 404 });
    }

    const user = userRes.rows[0] as { email: string; email_verified_at: string | null; is_banned: boolean };

    if (user.is_banned) {
      return NextResponse.json({ ok: false, error: 'Account is blocked.' }, { status: 403 });
    }

    if (user.email_verified_at) {
      return NextResponse.json({ ok: true, alreadyVerified: true, message: 'Email is already verified.' });
    }

    const token = generateEmailVerificationToken();
    const tokenHash = hashEmailVerificationToken(token);
    const expiresAt = emailVerificationExpiryDate();

    await db.query('DELETE FROM email_verification_tokens WHERE user_id = $1 AND used_at IS NULL', [userId]);

    await db.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt.toISOString()]
    );

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/auth/verify?token=${token}`;

    const template = verificationEmailTemplate(verifyUrl);
    const emailResult = await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });

    if (!emailResult.sent) {
      console.log(`[email-verify-resend-dev-fallback] ${verifyUrl}`);
    }

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        ok: true,
        message: 'Verification link generated.',
        devVerifyUrl: verifyUrl,
        verifyExpiresInHours: EMAIL_VERIFICATION_TTL_HOURS
      });
    }

    return NextResponse.json({ ok: true, message: 'Verification link sent.' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to resend verification' },
      { status: 400 }
    );
  }
}
