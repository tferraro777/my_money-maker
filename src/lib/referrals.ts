import { db } from '@/lib/db';
import {
  canonicalizeEmail,
  emailBaseFingerprint,
  isLikelyAliasPattern,
  similarityScore
} from '@/lib/email';

const SIMILARITY_THRESHOLD = 0.89;
const MAX_BANKED_DAYS = 30;

export async function persistEmailFingerprint(userId: string, email: string): Promise<void> {
  const canonical = canonicalizeEmail(email);
  const [localPart, domain = ''] = canonical.split('@');

  await db.query(
    `INSERT INTO email_fingerprints (user_id, canonical_email, email_base_fingerprint, domain, local_part)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id)
     DO UPDATE SET canonical_email = EXCLUDED.canonical_email,
                   email_base_fingerprint = EXCLUDED.email_base_fingerprint,
                   domain = EXCLUDED.domain,
                   local_part = EXCLUDED.local_part`,
    [userId, canonical, emailBaseFingerprint(email), domain, localPart]
  );
}

type AbuseCheckResult = {
  shouldBlockCredit: boolean;
  matchedUserId?: string;
  similarity?: number;
  reason?: string;
};

export async function checkReferralAbuse(referrerUserId: string, referredUserId: string): Promise<AbuseCheckResult> {
  const res = await db.query(
    `SELECT ef.user_id, ef.local_part, ef.domain
     FROM email_fingerprints ef
     WHERE ef.user_id IN ($1, $2)`,
    [referrerUserId, referredUserId]
  );

  if ((res.rowCount ?? 0) < 2) {
    return { shouldBlockCredit: false };
  }

  const referrer = res.rows.find((row) => row.user_id === referrerUserId);
  const referred = res.rows.find((row) => row.user_id === referredUserId);

  if (!referrer || !referred) return { shouldBlockCredit: false };
  if (referrer.domain !== referred.domain) return { shouldBlockCredit: false };

  const similarity = similarityScore(referrer.local_part, referred.local_part);
  const aliasPattern = isLikelyAliasPattern(referrer.local_part, referred.local_part);

  if (similarity >= SIMILARITY_THRESHOLD || aliasPattern) {
    await db.query(
      `INSERT INTO abuse_flags (user_id, flag_type, confidence, details)
       VALUES ($1, 'referral_email_similarity', $2, $3::jsonb),
              ($4, 'referral_email_similarity', $2, $3::jsonb)`,
      [
        referrerUserId,
        Number(similarity.toFixed(3)),
        JSON.stringify({
          referrerLocal: referrer.local_part,
          referredLocal: referred.local_part,
          domain: referrer.domain,
          similarity,
          aliasPattern
        }),
        referredUserId
      ]
    );

    return {
      shouldBlockCredit: true,
      similarity,
      matchedUserId: referredUserId,
      reason: aliasPattern ? 'numeric_alias_pattern' : 'high_similarity'
    };
  }

  return { shouldBlockCredit: false };
}

export async function grantReferralDay(referrerUserId: string): Promise<void> {
  await db.query(
    `INSERT INTO free_access (user_id, free_access_until, banked_referral_days)
     VALUES ($1, now() + interval '1 day', 1)
     ON CONFLICT (user_id)
     DO UPDATE SET
       banked_referral_days = LEAST(${MAX_BANKED_DAYS}, free_access.banked_referral_days + 1),
       free_access_until = LEAST(
         now() + interval '${MAX_BANKED_DAYS} day',
         GREATEST(COALESCE(free_access.free_access_until, now()), now()) + interval '1 day'
       ),
       updated_at = now()`,
    [referrerUserId]
  );
}

export async function processReferralCredit(referredUserId: string): Promise<{ credited: boolean; reason?: string }> {
  const referralRes = await db.query(
    `SELECT id, referrer_user_id
     FROM referrals
     WHERE referred_user_id = $1 AND status = 'pending'
     LIMIT 1`,
    [referredUserId]
  );

  if ((referralRes.rowCount ?? 0) === 0) {
    return { credited: false, reason: 'no_pending_referral' };
  }

  const referral = referralRes.rows[0] as { id: string; referrer_user_id: string };

  const checks = await Promise.all([
    db.query('SELECT email_verified_at FROM users WHERE id = $1', [referredUserId]),
    db.query('SELECT onboarding_completed_at FROM user_profiles WHERE user_id = $1', [referredUserId]),
    db.query("SELECT 1 FROM messages WHERE user_id = $1 AND role = 'user' LIMIT 1", [referredUserId]),
    checkReferralAbuse(referral.referrer_user_id, referredUserId)
  ]);

  const isEmailVerified = !!checks[0].rows[0]?.email_verified_at;
  const isOnboardingComplete = !!checks[1].rows[0]?.onboarding_completed_at;
  const hasFirstQuestion = (checks[2].rowCount ?? 0) > 0;
  const abuse = checks[3];

  if (abuse.shouldBlockCredit) {
    await db.query(
      `UPDATE referrals
       SET status = 'rejected', reject_reason = $2, updated_at = now()
       WHERE id = $1`,
      [referral.id, `abuse:${abuse.reason}`]
    );
    return { credited: false, reason: abuse.reason };
  }

  if (!isEmailVerified) {
    return { credited: false, reason: 'email_not_verified' };
  }

  if (!isOnboardingComplete || !hasFirstQuestion) {
    return { credited: false, reason: 'requirements_not_met' };
  }

  await grantReferralDay(referral.referrer_user_id);

  await db.query(
    `UPDATE referrals
     SET status = 'credited', credit_granted_at = now(), updated_at = now()
     WHERE id = $1`,
    [referral.id]
  );

  return { credited: true };
}
