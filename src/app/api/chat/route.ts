import { NextResponse } from 'next/server';
import { requireUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateAssistantReply } from '@/lib/ai';
import { canAskAiQuestion, incrementUsageOnSuccess } from '@/lib/usage';
import { chatSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();

    let rawPayload: Record<string, unknown>;
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      rawPayload = (await req.json()) as Record<string, unknown>;
    } else {
      const formData = await req.formData();
      rawPayload = {
        mode: formData.get('mode'),
        prompt: formData.get('prompt'),
        conversationId: formData.get('conversationId'),
        activeCompanyId: formData.get('activeCompanyId')
      };
    }

    const payload = chatSchema.parse(rawPayload);

    const verifiedRes = await db.query('SELECT email_verified_at FROM users WHERE id = $1', [userId]);
    const emailVerifiedAt = verifiedRes.rows[0]?.email_verified_at ?? null;
    if (!emailVerifiedAt) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Please verify your email before using AI chat.',
          needsEmailVerification: true,
          verifyPath: '/auth/verify/resend'
        },
        { status: 403 }
      );
    }
    const gate = await canAskAiQuestion(userId);

    if (!gate.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No free questions remaining. Subscribe or earn referral free days.',
          freeQuestionsRemaining: gate.freeQuestionsRemaining,
          needsSubscription: true,
          checkoutPath: '/api/stripe/checkout',
          portalPath: '/api/stripe/portal'
        },
        { status: 402 }
      );
    }

    const convoId = payload.conversationId
      ? payload.conversationId
      : (
          await db.query(
            `INSERT INTO conversations (user_id, active_company_id, mode)
             VALUES ($1, $2, $3)
             RETURNING id`,
            [userId, payload.activeCompanyId ?? null, payload.mode]
          )
        ).rows[0].id;

    await db.query(
      `INSERT INTO messages (conversation_id, user_id, role, content, mode)
       VALUES ($1, $2, 'user', $3, $4)`,
      [convoId, userId, payload.prompt, payload.mode]
    );

    const ai = await generateAssistantReply({
      userId,
      mode: payload.mode,
      prompt: payload.prompt,
      companyContext: payload.activeCompanyId ?? null
    });

    const assistantMsg = await db.query(
      `INSERT INTO messages (
         conversation_id, user_id, role, content, token_usage, latency_ms, cost_estimate_usd, mode
       ) VALUES ($1,$2,'assistant',$3,$4,$5,$6,$7)
       RETURNING id`,
      [convoId, userId, ai.output, ai.tokenInput + ai.tokenOutput, ai.latencyMs, ai.costEstimateUsd, payload.mode]
    );

    await incrementUsageOnSuccess(userId);

    return NextResponse.json({
      ok: true,
      conversationId: convoId,
      messageId: assistantMsg.rows[0].id,
      answer: ai.output,
      helpfulness: {
        yes: true,
        no: true,
        endpoint: '/api/messages/helpfulness'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'AI request failed' },
      { status: 400 }
    );
  }
}
