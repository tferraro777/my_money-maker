import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { buildStorageKey, createUploadUrl, uploadObject } from '@/lib/r2';

export const runtime = 'nodejs';

const ACCEPTED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

const jsonUploadSchema = z.object({
  fileName: z.string().min(1).max(240),
  mimeType: z.string().min(1),
  byteSize: z.number().int().positive().max(25 * 1024 * 1024),
  scope: z.enum(['user', 'company', 'global']).optional(),
  companyId: z.string().uuid().nullable().optional()
});

function sourceTypeForMime(mimeType: string): 'pdf' | 'docx' | 'txt' | 'xls' {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('wordprocessingml')) return 'docx';
  if (mimeType.includes('text')) return 'txt';
  return 'xls';
}

async function createFileRow(input: {
  userId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  scope: 'user' | 'company' | 'global';
  companyId: string | null;
  storageKey: string;
}): Promise<string> {
  const res = await db.query(
    `INSERT INTO files (user_id, company_id, scope, source_type, storage_key, mime_type, byte_size, is_manuscript)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     RETURNING id`,
    [
      input.userId,
      input.companyId,
      input.scope,
      sourceTypeForMime(input.mimeType),
      input.storageKey,
      input.mimeType,
      input.byteSize
    ]
  );
  return String(res.rows[0].id);
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const payload = jsonUploadSchema.parse(await req.json());
      if (!ACCEPTED.has(payload.mimeType)) {
        return NextResponse.json({ ok: false, error: 'Unsupported file type' }, { status: 400 });
      }

      const scope = payload.scope ?? 'user';
      const companyId = scope === 'company' ? payload.companyId ?? null : null;
      const storageKey = buildStorageKey(userId, payload.fileName);
      const fileId = await createFileRow({
        userId,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        byteSize: payload.byteSize,
        scope,
        companyId,
        storageKey
      });

      const uploadUrl = await createUploadUrl({
        storageKey,
        contentType: payload.mimeType
      });

      return NextResponse.json({
        ok: true,
        fileId,
        storageKey,
        upload: {
          method: 'PUT',
          url: uploadUrl,
          headers: { 'Content-Type': payload.mimeType }
        }
      });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
    }
    if (!ACCEPTED.has(file.type)) {
      return NextResponse.json({ ok: false, error: 'Unsupported file type' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'File too large. Max 25MB.' }, { status: 413 });
    }

    const scopeValue = String(form.get('scope') || 'user');
    const scope: 'user' | 'company' | 'global' =
      scopeValue === 'company' || scopeValue === 'global' ? scopeValue : 'user';
    const companyIdRaw = form.get('companyId');
    const companyId = scope === 'company' && typeof companyIdRaw === 'string' ? companyIdRaw : null;

    const storageKey = buildStorageKey(userId, file.name);
    const body = Buffer.from(await file.arrayBuffer());
    await uploadObject({
      storageKey,
      contentType: file.type,
      body
    });

    const fileId = await createFileRow({
      userId,
      fileName: file.name,
      mimeType: file.type,
      byteSize: file.size,
      scope,
      companyId,
      storageKey
    });

    return NextResponse.json({ ok: true, fileId, storageKey, uploaded: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 }
    );
  }
}
