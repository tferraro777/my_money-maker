import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }

  const userRes = await db.query('SELECT id, email, role FROM users WHERE id = $1 LIMIT 1', [userId]);
  if ((userRes.rowCount ?? 0) === 0) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }

  const user = userRes.rows[0] as { id: string; email: string; role: string };
  return NextResponse.json({ ok: true, authenticated: true, user });
}
