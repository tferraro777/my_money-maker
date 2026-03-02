import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { pathToFileURL } from 'url';
import pg from 'pg';
import OpenAI from 'openai';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import XLSX from 'xlsx';

const { Pool } = pg;

const DEV_USER_ID = process.env.DEV_USER_ID || '00000000-0000-0000-0000-000000000001';
const DATABASE_URL = process.env.DATABASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!DATABASE_URL) {
  throw new Error('Missing DATABASE_URL env var');
}
if (!OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY env var');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.xls', '.xlsx']);

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function truncateForModel(text, maxChars = 14000) {
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}

async function summarizeConcepts(text) {
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
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    input: prompt
  });

  const raw = res.output_text || '{}';
  try {
    const parsed = JSON.parse(raw);
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

async function embed(text) {
  const emb = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return emb.data[0].embedding;
}

function fileMeta(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return { sourceType: 'pdf', mimeType: 'application/pdf' };
  if (ext === '.docx') {
    return {
      sourceType: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
  }
  if (ext === '.txt') return { sourceType: 'txt', mimeType: 'text/plain' };
  return { sourceType: 'xls', mimeType: 'application/vnd.ms-excel' };
}

function extractSpreadsheetText(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  return wb.SheetNames.map((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return `Sheet: ${sheetName}\n${csv}`;
  }).join('\n\n');
}

async function extractText(filePath, buffer) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const parsed = await pdf(buffer);
    return parsed.text || '';
  }
  if (ext === '.docx') {
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value || '';
  }
  if (ext === '.txt') {
    return buffer.toString('utf8');
  }
  if (ext === '.xls' || ext === '.xlsx') {
    return extractSpreadsheetText(buffer);
  }
  return '';
}

async function ingestFile(filePath, pool) {
  const buffer = await fs.readFile(filePath);
  const rawText = await extractText(filePath, buffer);
  const text = normalizeText(rawText);
  if (!text) {
    console.log(`Skipping empty text: ${path.basename(filePath)}`);
    return;
  }

  const meta = fileMeta(filePath);
  const concepts = await summarizeConcepts(text);
  const embedding = await embed(`${concepts.summary}\n${concepts.lexicon.join(', ')}\n${concepts.conceptTags.join(', ')}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM files WHERE storage_key = $1 LIMIT 1', [filePath]);
    if (existing.rowCount) {
      await client.query('COMMIT');
      console.log(`Already ingested: ${path.basename(filePath)}`);
      return;
    }

    const fileRes = await client.query(
      `INSERT INTO files (
        user_id, scope, source_type, storage_key, mime_type, byte_size, is_manuscript, processed_at
      ) VALUES ($1, 'global', $2, $3, $4, $5, true, now())
      RETURNING id`,
      [DEV_USER_ID, meta.sourceType, filePath, meta.mimeType, buffer.length]
    );

    const vectorLiteral = `[${embedding.join(',')}]`;

    await client.query(
      `INSERT INTO knowledge_embeddings (
        file_id, user_id, company_id, scope, content_summary, lexicon, concept_tags, embedding
      ) VALUES ($1, NULL, NULL, 'global', $2, $3::jsonb, $4, $5::vector)`,
      [
        fileRes.rows[0].id,
        concepts.summary,
        JSON.stringify(concepts.lexicon),
        concepts.conceptTags,
        vectorLiteral
      ]
    );

    await client.query('COMMIT');
    console.log(`Ingested: ${path.basename(filePath)}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function runIngestion(manuscriptDir) {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const stat = await fs.stat(manuscriptDir);
    if (!stat.isDirectory()) {
      throw new Error('Provided path is not a directory');
    }

    const entries = await fs.readdir(manuscriptDir);
    const ingestibleFiles = entries
      .filter((name) => SUPPORTED_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .map((name) => path.join(manuscriptDir, name));

    if (!ingestibleFiles.length) {
      console.log('No ingestible files found.');
      return;
    }

    console.log(`Found ${ingestibleFiles.length} ingestible files.`);
    for (const filePath of ingestibleFiles) {
      await ingestFile(filePath, pool);
    }

    console.log('Done.');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manuscriptDir = process.argv[2];
  if (!manuscriptDir) {
    console.error('Usage: node scripts/load-manuscripts.mjs "<manuscripts_dir>"');
    process.exit(1);
  }

  runIngestion(manuscriptDir).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
