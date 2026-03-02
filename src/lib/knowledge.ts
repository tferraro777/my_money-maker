import { db } from '@/lib/db';

const QUOTE_BLOCK_MAX_SEQUENCE = 18;

export function redactPotentialQuote(text: string): string {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length <= QUOTE_BLOCK_MAX_SEQUENCE) {
    return text;
  }

  // Prevent long verbatim passages in outputs.
  return tokens.slice(0, QUOTE_BLOCK_MAX_SEQUENCE).join(' ') + ' ...';
}

export async function saveEmbeddingSummary(input: {
  fileId: string;
  userId: string | null;
  companyId: string | null;
  scope: 'user' | 'company' | 'global';
  contentSummary: string;
  lexicon: string[];
  conceptTags: string[];
  embedding: number[];
}): Promise<void> {
  await db.query(
    `INSERT INTO knowledge_embeddings (
      file_id, user_id, company_id, scope, content_summary, lexicon, concept_tags, embedding
    ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::vector)`,
    [
      input.fileId,
      input.userId,
      input.companyId,
      input.scope,
      input.contentSummary,
      JSON.stringify(input.lexicon),
      input.conceptTags,
      `[${input.embedding.join(',')}]`
    ]
  );
}
