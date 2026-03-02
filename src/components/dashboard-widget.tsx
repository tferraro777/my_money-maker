import { db } from '@/lib/db';

export async function DashboardWidget({ userId }: { userId: string }) {
  let row: {
    messages_sent: number;
    follow_ups: number;
    posts: number;
    calls: number;
    presentations: number;
  } = {
    messages_sent: 0,
    follow_ups: 0,
    posts: 0,
    calls: 0,
    presentations: 0
  };

  try {
    const res = await db.query(
      `SELECT
        COALESCE(SUM(quantity) FILTER (WHERE activity_type = 'outreach_messages' AND occurred_at::date = now()::date), 0) AS messages_sent,
        COALESCE(SUM(quantity) FILTER (WHERE activity_type = 'follow_up_messages' AND occurred_at::date = now()::date), 0) AS follow_ups,
        COALESCE(SUM(quantity) FILTER (WHERE activity_type = 'content_posts' AND occurred_at::date = now()::date), 0) AS posts,
        COALESCE(SUM(quantity) FILTER (WHERE activity_type = 'calls_booked' AND occurred_at::date = now()::date), 0) AS calls,
        COALESCE(SUM(quantity) FILTER (WHERE activity_type = 'presentations_given' AND occurred_at::date = now()::date), 0) AS presentations
       FROM activity_entries
       WHERE user_id = $1`,
      [userId]
    );

    row = {
      messages_sent: Number(res.rows[0]?.messages_sent ?? 0),
      follow_ups: Number(res.rows[0]?.follow_ups ?? 0),
      posts: Number(res.rows[0]?.posts ?? 0),
      calls: Number(res.rows[0]?.calls ?? 0),
      presentations: Number(res.rows[0]?.presentations ?? 0)
    };
  } catch {
    // Fails safe if DB query errors so dashboard route still renders.
  }

  const activityScore =
    Number(row.messages_sent) +
    Number(row.follow_ups) * 2 +
    Number(row.posts) * 2 +
    Number(row.calls) * 3 +
    Number(row.presentations) * 4;

  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold">Today&apos;s Scoreboard</h2>
      <p className="text-3xl font-bold text-clemson-purple">{activityScore}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <p>Messages: {row.messages_sent}</p>
        <p>Follow-ups: {row.follow_ups}</p>
        <p>Posts: {row.posts}</p>
        <p>Calls: {row.calls}</p>
        <p>Presentations: {row.presentations}</p>
      </div>
    </div>
  );
}
