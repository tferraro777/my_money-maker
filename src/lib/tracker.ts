import { db } from '@/lib/db';

export async function addIncomeEntry(input: {
  userId: string;
  companyId: string | null;
  occurredAt: string;
  userTimezone: string;
  amount: number;
  currency: string;
  type: 'sale' | 'commission' | 'bonus' | 'other';
  notes?: string;
}): Promise<void> {
  await db.query(
    `INSERT INTO income_entries (user_id, company_id, occurred_at, user_timezone, amount, currency, type, notes)
     VALUES ($1, $2, $3::timestamptz, $4, $5, upper($6), $7, $8)`,
    [
      input.userId,
      input.companyId,
      input.occurredAt,
      input.userTimezone,
      input.amount,
      input.currency,
      input.type,
      input.notes ?? null
    ]
  );
}

export async function addActivityEntry(input: {
  userId: string;
  companyId: string | null;
  occurredAt: string;
  userTimezone: string;
  activityType:
    | 'outreach_messages'
    | 'follow_up_messages'
    | 'content_posts'
    | 'live_videos'
    | 'calls_booked'
    | 'presentations_given'
    | 'samples_sent'
    | 'team_trainings'
    | 'custom';
  quantity: number;
  notes?: string;
}): Promise<void> {
  await db.query(
    `INSERT INTO activity_entries (user_id, company_id, occurred_at, user_timezone, activity_type, quantity, notes)
     VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7)`,
    [
      input.userId,
      input.companyId,
      input.occurredAt,
      input.userTimezone,
      input.activityType,
      input.quantity,
      input.notes ?? null
    ]
  );
}

export async function getTrackerSnapshot(userId: string): Promise<{
  incomeTotals: Array<{ currency: string; today: string; week: string; month: string; rolling30d: string }>;
  activityTotals: Array<{ activity_type: string; total: number }>;
  streakDays: number;
}> {
  const [incomeRes, activityRes, activeDaysRes] = await Promise.all([
    db.query(
      `SELECT
         currency,
         SUM(amount) FILTER (WHERE occurred_at::date = now()::date) AS today,
         SUM(amount) FILTER (WHERE occurred_at >= now() - interval '7 day') AS week,
         SUM(amount) FILTER (WHERE occurred_at >= date_trunc('month', now())) AS month,
         SUM(amount) FILTER (WHERE occurred_at >= now() - interval '30 day') AS rolling30d
       FROM income_entries
       WHERE user_id = $1
       GROUP BY currency`,
      [userId]
    ),
    db.query(
      `SELECT activity_type, SUM(quantity)::int AS total
       FROM activity_entries
       WHERE user_id = $1 AND occurred_at >= now() - interval '30 day'
       GROUP BY activity_type
       ORDER BY total DESC`,
      [userId]
    ),
    db.query(
      `SELECT day FROM (
         SELECT DISTINCT occurred_at::date AS day
         FROM activity_entries
         WHERE user_id = $1
         UNION
         SELECT DISTINCT occurred_at::date AS day
         FROM income_entries
         WHERE user_id = $1
       ) d
       WHERE day <= CURRENT_DATE
       ORDER BY day DESC`,
      [userId]
    )
  ]);

  const activeDays = new Set<string>(
    activeDaysRes.rows.map((row) => new Date(row.day).toISOString().slice(0, 10))
  );
  let streakDays = 0;
  let cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  while (activeDays.has(cursor.toISOString().slice(0, 10))) {
    streakDays += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return {
    incomeTotals: incomeRes.rows.map((row) => ({
      currency: row.currency,
      today: row.today ?? '0',
      week: row.week ?? '0',
      month: row.month ?? '0',
      rolling30d: row.rolling30d ?? '0'
    })),
    activityTotals: activityRes.rows,
    streakDays
  };
}

export async function autoLogTaskActivities(taskId: string, userId: string, timezone: string): Promise<void> {
  const linkRes = await db.query(
    `SELECT activity_type, quantity
     FROM task_activity_links
     WHERE task_id = $1`,
    [taskId]
  );

  for (const link of linkRes.rows) {
    await addActivityEntry({
      userId,
      companyId: null,
      occurredAt: new Date().toISOString(),
      userTimezone: timezone,
      activityType: link.activity_type,
      quantity: link.quantity,
      notes: `Auto-logged from completed task ${taskId}`
    });
  }
}
