import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { processIngestionJob } from '@/lib/ingestion';

export const runtime = 'nodejs';

function authorized(req: Request): boolean {
  const secret = process.env.INGESTION_CRON_SECRET;
  if (!secret) {
    throw new Error('Missing required env var: INGESTION_CRON_SECRET');
  }

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const header = req.headers.get('x-ingestion-secret') || '';
  return bearer === secret || header === secret;
}

async function claimJobs(batchSize: number, workerId: string): Promise<string[]> {
  const res = await db.query(
    `WITH candidates AS (
       SELECT id
       FROM ingestion_jobs
       WHERE status IN ('pending', 'retryable')
         AND next_attempt_at <= now()
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE ingestion_jobs AS j
     SET
       status = 'processing',
       locked_at = now(),
       locked_by = $2,
       attempt_count = j.attempt_count + 1,
       updated_at = now()
     FROM candidates
     WHERE j.id = candidates.id
     RETURNING j.id`,
    [batchSize, workerId]
  );

  return res.rows.map((row) => String(row.id));
}

async function markJobRetryOrFail(jobId: string, errorMessage: string): Promise<void> {
  await db.query(
    `UPDATE ingestion_jobs
     SET
       status = CASE WHEN attempt_count >= max_attempts THEN 'failed' ELSE 'retryable' END,
       last_error = $2,
       locked_at = NULL,
       next_attempt_at = CASE
         WHEN attempt_count >= max_attempts THEN now()
         ELSE now() + interval '5 minutes'
       END,
       updated_at = now()
     WHERE id = $1`,
    [jobId, errorMessage.slice(0, 2000)]
  );
}

export async function POST(req: Request) {
  try {
    if (!authorized(req)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const workerId = randomUUID();
    const url = new URL(req.url);
    const requestedBatch = Number(url.searchParams.get('batch') || 3);
    const batchSize = Number.isFinite(requestedBatch) ? Math.max(1, Math.min(10, requestedBatch)) : 3;

    const jobIds = await claimJobs(batchSize, workerId);
    if (!jobIds.length) {
      return NextResponse.json({ ok: true, claimed: 0, completed: 0, failed: 0 });
    }

    let completed = 0;
    let failed = 0;

    for (const jobId of jobIds) {
      try {
        await processIngestionJob(jobId);
        completed += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Ingestion failed';
        await markJobRetryOrFail(jobId, message);
      }
    }

    return NextResponse.json({
      ok: true,
      claimed: jobIds.length,
      completed,
      failed
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Ingestion run failed' },
      { status: 400 }
    );
  }
}
