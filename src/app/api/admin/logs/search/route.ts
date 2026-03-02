import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const actorUserId = await requireUserId();
    const url = new URL(req.url);
    const query = url.searchParams.get('q') ?? '';
    const userId = url.searchParams.get('userId');
    const companyId = url.searchParams.get('companyId');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const roleRes = await db.query('SELECT role FROM users WHERE id = $1', [actorUserId]);
    const role = roleRes.rows[0]?.role;
    if (!role || !['admin', 'support', 'analyst'].includes(role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const whereParts: string[] = [];
    const values: unknown[] = [];

    if (query) {
      values.push(`%${query}%`);
      whereParts.push(`m.content ILIKE $${values.length}`);
    }
    if (userId) {
      values.push(userId);
      whereParts.push(`m.user_id = $${values.length}`);
    }
    if (companyId) {
      values.push(companyId);
      whereParts.push(`c.active_company_id = $${values.length}`);
    }
    if (startDate) {
      values.push(startDate);
      whereParts.push(`m.created_at >= $${values.length}::timestamptz`);
    }
    if (endDate) {
      values.push(endDate);
      whereParts.push(`m.created_at <= $${values.length}::timestamptz`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const logs = await db.query(
      `SELECT m.id, m.user_id, c.active_company_id, m.role, m.mode, m.content, m.created_at
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       ${whereSql}
       ORDER BY m.created_at DESC
       LIMIT 500`,
      values
    );

    return NextResponse.json({ ok: true, logs: logs.rows });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to search logs' },
      { status: 400 }
    );
  }
}
