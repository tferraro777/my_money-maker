import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import {
  emailVerificationExpiryDate,
  generateEmailVerificationToken,
  hashEmailVerificationToken,
  EMAIL_VERIFICATION_TTL_HOURS
} from '@/lib/email-verification';
import { sendEmail } from '@/lib/email-sender';
import { verificationEmailTemplate } from '@/lib/email-templates';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2)
});

export async function POST(req: Request) {
  try {
    const payload = registerSchema.parse(await req.json());

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [payload.email.toLowerCase()]);
    if ((existing.rowCount ?? 0) > 0) {
      return NextResponse.json({ ok: false, error: 'Email already registered.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(payload.password);
    const userRes = await db.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'user')
       RETURNING id, email`,
      [payload.email.toLowerCase(), passwordHash]
    );

    const user = userRes.rows[0] as { id: string; email: string };

    await db.query('INSERT INTO usage_counters (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [user.id]);
    await db.query('INSERT INTO free_access (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [user.id]);

    await db.query(
      `INSERT INTO user_profiles (
        user_id, full_name, phone_number, street, city, state_province, postal_code,
        country, birthdate, timezone, preferred_language, target_audience,
        experience_level, existing_systems, primary_goals
      ) VALUES (
        $1, $2, '', '', '', '', '',
        '', CURRENT_DATE, 'UTC', 'en', '{}'::jsonb,
        'beginner', '{}'::jsonb, '{}'
      )
      ON CONFLICT (user_id) DO NOTHING`,
      [user.id, payload.fullName]
    );

    const verifyToken = generateEmailVerificationToken();
    const verifyTokenHash = hashEmailVerificationToken(verifyToken);
    const verifyExpiry = emailVerificationExpiryDate();

    await db.query(
      `DELETE FROM email_verification_tokens WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    );

    await db.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, verifyTokenHash, verifyExpiry.toISOString()]
    );

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const verifyUrl = `${baseUrl}/auth/verify?token=${verifyToken}`;

    const token = await createSessionToken(user.id, user.email);
    await setSessionCookie(token);

    const template = verificationEmailTemplate(verifyUrl);
    const emailResult = await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text
    });

    if (!emailResult.sent) {
      console.log(`[email-verify-dev-fallback] ${verifyUrl}`);
    }

    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        ok: true,
        user: { id: user.id, email: user.email },
        devVerifyUrl: verifyUrl,
        verifyExpiresInHours: EMAIL_VERIFICATION_TTL_HOURS,
        emailSent: true
      });
    }

    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Registration failed' },
      { status: 400 }
    );
  }
}
