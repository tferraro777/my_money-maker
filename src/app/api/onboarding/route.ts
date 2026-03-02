import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { saveOnboarding } from '@/lib/onboarding';
import { onboardingSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const payload = onboardingSchema.parse(await req.json());

    await saveOnboarding({ userId, ...payload });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to save onboarding' },
      { status: 400 }
    );
  }
}
