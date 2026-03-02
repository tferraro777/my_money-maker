import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { addActivityEntry } from '@/lib/tracker';
import { activityEntrySchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const contentType = req.headers.get('content-type') ?? '';

    let raw: Record<string, unknown>;
    if (contentType.includes('application/json')) {
      raw = (await req.json()) as Record<string, unknown>;
    } else {
      const form = await req.formData();
      raw = {
        occurredAt: new Date(String(form.get('occurredAtLocal'))).toISOString(),
        userTimezone: form.get('userTimezone'),
        activityType: form.get('activityType'),
        quantity: Number(form.get('quantity')),
        notes: form.get('notes')
      };
    }

    const payload = activityEntrySchema.parse(raw);

    await addActivityEntry({
      userId,
      companyId: payload.companyId ?? null,
      occurredAt: payload.occurredAt,
      userTimezone: payload.userTimezone,
      activityType: payload.activityType,
      quantity: payload.quantity,
      notes: payload.notes ?? undefined
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to add activity entry' },
      { status: 400 }
    );
  }
}
