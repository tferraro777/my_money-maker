import { db } from '@/lib/db';

export type UsageGateResult = {
  allowed: boolean;
  reason?: 'no_access';
  freeQuestionsRemaining: number;
  hasSubscription: boolean;
  hasFreeDayAccess: boolean;
};

export async function canAskAiQuestion(userId: string): Promise<UsageGateResult> {
  const [usageRes, subscriptionRes, freeAccessRes] = await Promise.all([
    db.query('SELECT free_questions_remaining FROM usage_counters WHERE user_id = $1', [userId]),
    db.query(
      "SELECT status FROM subscriptions WHERE user_id = $1 AND status IN ('active', 'trial', 'past_due')",
      [userId]
    ),
    db.query('SELECT free_access_until FROM free_access WHERE user_id = $1', [userId])
  ]);

  const freeQuestionsRemaining = usageRes.rows[0]?.free_questions_remaining ?? 5;
  const hasSubscription = (subscriptionRes.rowCount ?? 0) > 0;
  const freeUntil = freeAccessRes.rows[0]?.free_access_until ? new Date(freeAccessRes.rows[0].free_access_until) : null;
  const hasFreeDayAccess = !!freeUntil && freeUntil > new Date();

  if (freeQuestionsRemaining > 0 || hasSubscription || hasFreeDayAccess) {
    return { allowed: true, freeQuestionsRemaining, hasSubscription, hasFreeDayAccess };
  }

  return { allowed: false, reason: 'no_access', freeQuestionsRemaining, hasSubscription, hasFreeDayAccess };
}

export async function incrementUsageOnSuccess(userId: string): Promise<void> {
  await db.query(
    `INSERT INTO usage_counters (user_id, free_questions_remaining, lifetime_questions_used, paid_questions_used)
     VALUES ($1, 5, 0, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  await db.query(
    `WITH flags AS (
      SELECT
        (SELECT free_questions_remaining FROM usage_counters WHERE user_id = $1) AS free_remaining,
        EXISTS (
          SELECT 1 FROM subscriptions WHERE user_id = $1 AND status IN ('active', 'trial', 'past_due')
        ) AS has_sub,
        EXISTS (
          SELECT 1 FROM free_access WHERE user_id = $1 AND free_access_until > now()
        ) AS has_free_day
    )
    UPDATE usage_counters
    SET
      lifetime_questions_used = usage_counters.lifetime_questions_used + 1,
      free_questions_remaining = CASE
        WHEN (SELECT free_remaining FROM flags) > 0
          THEN usage_counters.free_questions_remaining - 1
        ELSE usage_counters.free_questions_remaining
      END,
      paid_questions_used = CASE
        WHEN (SELECT free_remaining FROM flags) = 0
             AND ((SELECT has_sub FROM flags) OR (SELECT has_free_day FROM flags))
          THEN usage_counters.paid_questions_used + 1
        ELSE usage_counters.paid_questions_used
      END,
      updated_at = now()
    WHERE user_id = $1`,
    [userId]
  );
}
