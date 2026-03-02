import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { db } from '@/lib/db';

const ACCEPTED = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const form = await req.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
    }

    if (!ACCEPTED.has(file.type)) {
      return NextResponse.json({ ok: false, error: 'Unsupported file type' }, { status: 400 });
    }

    // Replace storage key generation/upload with S3/Supabase integration.
    const storageKey = `${userId}/${Date.now()}-${file.name}`;

    const sourceType = file.type.includes('pdf')
      ? 'pdf'
      : file.type.includes('wordprocessingml')
        ? 'docx'
        : file.type.includes('text')
          ? 'txt'
          : file.type.includes('excel') || file.type.includes('spreadsheetml')
            ? 'xls'
            : 'image';

    const fileRes = await db.query(
      `INSERT INTO files (user_id, scope, source_type, storage_key, mime_type, byte_size)
       VALUES ($1, 'user', $2, $3, $4, $5)
       RETURNING id`,
      [userId, sourceType, storageKey, file.type, file.size]
    );

    return NextResponse.json({ ok: true, fileId: fileRes.rows[0].id, storageKey });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 }
    );
  }
}
