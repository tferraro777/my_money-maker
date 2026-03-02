import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { autoLogTaskActivities } from '@/lib/tracker';

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = (await req.json()) as { taskId?: string; timezone?: string };

    if (!body.taskId || !body.timezone) {
      return NextResponse.json({ ok: false, error: 'taskId and timezone are required' }, { status: 400 });
    }

    await db.query(
      `UPDATE tasks
       SET completed_at = now(), updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [body.taskId, userId]
    );

    await autoLogTaskActivities(body.taskId, userId, body.timezone);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to complete task' },
      { status: 400 }
    );
  }
}
