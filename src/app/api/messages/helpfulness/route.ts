import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const payload = (await req.json()) as {
      messageId?: string;
      vote?: 'yes' | 'no';
      reason?: string;
    };

    if (!payload.messageId || !payload.vote) {
      return NextResponse.json({ ok: false, error: 'messageId and vote are required' }, { status: 400 });
    }

    await db.query(
      `INSERT INTO helpfulness_votes (message_id, user_id, vote, reason)
       VALUES ($1, $2, $3, $4)`,
      [payload.messageId, userId, payload.vote, payload.reason ?? null]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to save helpfulness vote' },
      { status: 400 }
    );
  }
}
