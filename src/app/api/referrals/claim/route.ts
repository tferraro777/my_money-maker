import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { processReferralCredit } from '@/lib/referrals';

export async function POST() {
  try {
    const referredUserId = await requireUserId();
    const result = await processReferralCredit(referredUserId);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to process referral claim' },
      { status: 400 }
    );
  }
}
