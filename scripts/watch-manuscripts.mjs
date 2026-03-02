import path from 'path';
import process from 'process';
import chokidar from 'chokidar';
import { runIngestion } from './load-manuscripts.mjs';

const WATCH_DIR = process.argv[2];

if (!WATCH_DIR) {
  console.error('Usage: node scripts/watch-manuscripts.mjs "<manuscripts_dir>"');
  process.exit(1);
}

const absoluteDir = path.resolve(WATCH_DIR);
const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.xls', '.xlsx']);

let timer = null;
let isRunning = false;
let hasPending = false;

function isSupported(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function triggerIngestion(reason) {
  if (isRunning) {
    hasPending = true;
    return;
  }

  isRunning = true;
  console.log(`[watch] Triggered by ${reason}. Running ingestion...`);
  try {
    await runIngestion(absoluteDir);
    console.log('[watch] Ingestion run completed.');
  } catch (error) {
    console.error('[watch] Ingestion failed:', error);
  } finally {
    isRunning = false;
    if (hasPending) {
      hasPending = false;
      await triggerIngestion('queued changes');
    }
  }
}

function schedule(reason) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    triggerIngestion(reason).catch((error) => {
      console.error('[watch] Unexpected failure:', error);
    });
  }, 1200);
}

const watcher = chokidar.watch(absoluteDir, {
  ignoreInitial: false,
  persistent: true,
  awaitWriteFinish: {
    stabilityThreshold: 1500,
    pollInterval: 100
  }
});

watcher.on('ready', () => {
  console.log(`[watch] Watching: ${absoluteDir}`);
  schedule('startup scan');
});

watcher.on('add', (filePath) => {
  if (isSupported(filePath)) {
    console.log(`[watch] New file detected: ${path.basename(filePath)}`);
    schedule('new file');
  }
});

watcher.on('change', (filePath) => {
  if (isSupported(filePath)) {
    console.log(`[watch] File changed: ${path.basename(filePath)}`);
    schedule('updated file');
  }
});

watcher.on('error', (error) => {
  console.error('[watch] File watcher error:', error);
});

process.on('SIGINT', async () => {
  console.log('\n[watch] Shutting down...');
  await watcher.close();
  process.exit(0);
});
