import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { enqueueIngestionJob } from '@/lib/ingestion';

const processSchema = z.object({
  fileId: z.string().uuid()
});

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const payload = processSchema.parse(await req.json());

    const fileRes = await db.query(
      `SELECT id FROM files
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [payload.fileId, userId]
    );

    if ((fileRes.rowCount ?? 0) === 0) {
      return NextResponse.json({ ok: false, error: 'File not found.' }, { status: 404 });
    }

    const jobId = await enqueueIngestionJob(payload.fileId);
    return NextResponse.json({ ok: true, queued: true, jobId });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Queueing failed' },
      { status: 400 }
    );
  }
}
