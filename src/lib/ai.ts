import OpenAI from 'openai';
import { db } from '@/lib/db';
import { ChatMode, MODE_SYSTEM_HINTS } from '@/lib/modes';

const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

const SYSTEM_POLICY = `You are My Money Maker, a business assistant for network marketing, direct sales, affiliate sales, and social selling.

Rules:
1) Coach with practical, ethical, non-spam strategies.
2) For products, prioritize pain -> problem -> solution -> outcome messaging.
3) Never produce medical claims or regulated claims.
4) If internal manuscripts informed concepts, never mention or quote those manuscripts.
5) Never reproduce identifiable passages from proprietary content.
6) Keep answers clear, actionable, and encouraging.
7) End every response with one relevant next-step question offering concrete help (for example: draft script, build list, write post, create plan).`;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function quoteBlockFilter(text: string): string {
  return text
    .replace(/according to the manuscript[s]?/gi, 'based on business best practices')
    .replace(/as described in chapter\s+\d+/gi, 'from practical frameworks');
}

async function buildKnowledgeContext(params: {
  userId: string;
  prompt: string;
  companyContext?: string | null;
}): Promise<string> {
  const emb = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: params.prompt
  });

  const queryVector = `[${emb.data[0].embedding.join(',')}]`;

  const contextRes = await db.query(
    `SELECT
      ke.content_summary,
      ke.lexicon,
      ke.concept_tags,
      1 - (ke.embedding <=> $1::vector) AS similarity
     FROM knowledge_embeddings ke
     WHERE ke.scope = 'global'
        OR (ke.scope = 'user' AND ke.user_id = $2)
        OR (ke.scope = 'company' AND ke.company_id = $3::uuid)
     ORDER BY ke.embedding <=> $1::vector ASC
     LIMIT 6`,
    [queryVector, params.userId, params.companyContext ?? null]
  );

  if (!contextRes.rowCount) {
    return 'No internal concept context found.';
  }

  return contextRes.rows
    .map((row, idx) => {
      const lexicon = Array.isArray(row.lexicon) ? row.lexicon.join(', ') : '';
      const tags = Array.isArray(row.concept_tags) ? row.concept_tags.join(', ') : '';
      const similarity = Number(row.similarity ?? 0).toFixed(3);
      return `${idx + 1}. Similarity ${similarity}\nSummary: ${row.content_summary}\nLexicon: ${lexicon}\nTags: ${tags}`;
    })
    .join('\n\n');
}

export async function generateAssistantReply(params: {
  userId: string;
  mode: ChatMode;
  prompt: string;
  companyContext?: string | null;
}): Promise<{
  output: string;
  tokenInput: number;
  tokenOutput: number;
  latencyMs: number;
  costEstimateUsd: number;
}> {
  const started = Date.now();
  const knowledgeContext = await buildKnowledgeContext(params);

  const completion = await client.responses.create({
    model,
    input: [
      { role: 'system', content: `${SYSTEM_POLICY}\n\nMode: ${params.mode}. ${MODE_SYSTEM_HINTS[params.mode]}` },
      {
        role: 'user',
        content: `Active company context: ${params.companyContext ?? 'none'}

Internal concept context (do not cite sources, do not quote):
${knowledgeContext}

User request:
${params.prompt}`
      }
    ]
  });

  const latencyMs = Date.now() - started;
  const output = quoteBlockFilter(completion.output_text || 'I can help with that.');
  const tokenInput = completion.usage?.input_tokens ?? 0;
  const tokenOutput = completion.usage?.output_tokens ?? 0;

  // Coarse cost estimate that can be replaced with exact per-model pricing config.
  const costEstimateUsd = Number(((tokenInput * 0.0000006) + (tokenOutput * 0.0000024)).toFixed(6));

  await db.query(
    `INSERT INTO ai_calls (user_id, request_payload, response_payload, status, model, token_input, token_output, latency_ms, cost_estimate_usd)
     VALUES ($1, $2::jsonb, $3::jsonb, 'success', $4, $5, $6, $7, $8)`,
    [
      params.userId,
      JSON.stringify({
        mode: params.mode,
        prompt: params.prompt,
        companyContext: params.companyContext ?? null,
        knowledgeContextUsed: !!knowledgeContext && knowledgeContext !== 'No internal concept context found.'
      }),
      JSON.stringify({ output }),
      model,
      tokenInput,
      tokenOutput,
      latencyMs,
      costEstimateUsd
    ]
  );

  return { output, tokenInput, tokenOutput, latencyMs, costEstimateUsd };
}
