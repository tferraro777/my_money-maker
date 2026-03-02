import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { addIncomeEntry } from '@/lib/tracker';
import { incomeEntrySchema } from '@/lib/validation';

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
        amount: Number(form.get('amount')),
        currency: form.get('currency'),
        type: form.get('type'),
        notes: form.get('notes')
      };
    }

    const payload = incomeEntrySchema.parse(raw);

    await addIncomeEntry({
      userId,
      companyId: payload.companyId ?? null,
      occurredAt: payload.occurredAt,
      userTimezone: payload.userTimezone,
      amount: payload.amount,
      currency: payload.currency,
      type: payload.type,
      notes: payload.notes ?? undefined
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to add income entry' },
      { status: 400 }
    );
  }
}
