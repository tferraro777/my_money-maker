import OpenAI from 'openai';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { db, withTransaction } from '@/lib/db';
import { downloadObject } from '@/lib/r2';
import { requireOpenAiKey } from '@/lib/env';

// pdf-parse has no bundled TS types in this project.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';

const openai = new OpenAI({ apiKey: requireOpenAiKey() });
const EMBEDDING_MODEL = 'text-embedding-3-small';
const SUMMARIZE_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncateForModel(text: string, maxChars = 14000): string {
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}

function extractSpreadsheetText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return `Sheet: ${sheetName}\n${csv}`;
  }).join('\n\n');
}

export async function extractTextFromBuffer(sourceType: string, buffer: Buffer): Promise<string> {
  if (sourceType === 'pdf') {
    const parsed = await pdf(buffer);
    return parsed.text || '';
  }

  if (sourceType === 'docx') {
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value || '';
  }

  if (sourceType === 'txt') {
    return buffer.toString('utf8');
  }

  if (sourceType === 'xls') {
    return extractSpreadsheetText(buffer);
  }

  throw new Error(`Unsupported source_type for ingestion: ${sourceType}`);
}

async function summarizeConcepts(text: string): Promise<{
  summary: string;
  lexicon: string[];
  conceptTags: string[];
}> {
  const prompt = `Extract generalized business concepts and terminology from this manuscript text.

Rules:
- Do NOT quote or reproduce passages.
- Do NOT include identifiable sentence fragments from source.
- Return only JSON with keys: summary, lexicon, concept_tags.
- summary: max 120 words, paraphrased.
- lexicon: array of up to 20 short terms/phrases.
- concept_tags: array of up to 12 conceptual tags.

Text:\n${truncateForModel(text)}`;

  const res = await openai.responses.create({
    model: SUMMARIZE_MODEL,
    input: prompt
  });

  const raw = res.output_text || '{}';

  try {
    const parsed = JSON.parse(raw) as {
      summary?: string;
      lexicon?: unknown[];
      concept_tags?: unknown[];
    };
    return {
      summary: String(parsed.summary || 'Conceptual business guidance extracted.'),
      lexicon: Array.isArray(parsed.lexicon) ? parsed.lexicon.map(String).slice(0, 20) : [],
      conceptTags: Array.isArray(parsed.concept_tags) ? parsed.concept_tags.map(String).slice(0, 12) : []
    };
  } catch {
    return {
      summary: 'Conceptual business guidance extracted and paraphrased for assistant use.',
      lexicon: [],
      conceptTags: []
    };
  }
}

async function embedConcepts(summary: string, lexicon: string[], conceptTags: string[]): Promise<number[]> {
  const text = `${summary}\n${lexicon.join(', ')}\n${conceptTags.join(', ')}`;
  const emb = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text
  });
  return emb.data[0].embedding;
}

export async function processIngestionJob(jobId: string): Promise<void> {
  const jobRes = await db.query(
    `SELECT
      j.id,
      j.file_id,
      f.user_id,
      f.company_id,
      f.scope,
      f.source_type,
      f.storage_key
     FROM ingestion_jobs j
     JOIN files f ON f.id = j.file_id
     WHERE j.id = $1
     LIMIT 1`,
    [jobId]
  );

  if ((jobRes.rowCount ?? 0) === 0) {
    throw new Error('Ingestion job not found.');
  }

  const job = jobRes.rows[0] as {
    id: string;
    file_id: string;
    user_id: string;
    company_id: string | null;
    scope: 'user' | 'company' | 'global';
    source_type: string;
    storage_key: string;
  };

  const buffer = await downloadObject(job.storage_key);
  const extracted = await extractTextFromBuffer(job.source_type, buffer);
  const normalized = normalizeText(extracted);
  if (!normalized) {
    throw new Error('No extractable text found.');
  }

  const concepts = await summarizeConcepts(normalized);
  const embedding = await embedConcepts(concepts.summary, concepts.lexicon, concepts.conceptTags);

  await withTransaction(async (client) => {
    await client.query('DELETE FROM knowledge_embeddings WHERE file_id = $1', [job.file_id]);
    await client.query(
      `INSERT INTO knowledge_embeddings (
         file_id, user_id, company_id, scope, content_summary, lexicon, concept_tags, embedding
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::vector)`,
      [
        job.file_id,
        job.scope === 'global' ? null : job.user_id,
        job.scope === 'company' ? job.company_id : null,
        job.scope,
        concepts.summary,
        JSON.stringify(concepts.lexicon),
        concepts.conceptTags,
        `[${embedding.join(',')}]`
      ]
    );

    await client.query('UPDATE files SET processed_at = now() WHERE id = $1', [job.file_id]);
    await client.query(
      `UPDATE ingestion_jobs
       SET status = 'completed', processed_at = now(), locked_at = NULL, last_error = NULL, updated_at = now()
       WHERE id = $1`,
      [job.id]
    );
  });
}

export async function enqueueIngestionJob(fileId: string): Promise<string> {
  const res = await db.query(
    `INSERT INTO ingestion_jobs (file_id, status, next_attempt_at)
     VALUES ($1, 'pending', now())
     ON CONFLICT (file_id)
     DO UPDATE SET
       status = 'pending',
       last_error = NULL,
       locked_at = NULL,
       next_attempt_at = now(),
       updated_at = now()
     RETURNING id`,
    [fileId]
  );

  return String(res.rows[0].id);
}
