CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retryable')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(file_id)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status_next_attempt
  ON ingestion_jobs(status, next_attempt_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_embeddings_file_unique
  ON knowledge_embeddings(file_id)
  WHERE file_id IS NOT NULL;

DO $$ BEGIN
  CREATE TRIGGER ingestion_jobs_updated_at
    BEFORE UPDATE ON ingestion_jobs
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
