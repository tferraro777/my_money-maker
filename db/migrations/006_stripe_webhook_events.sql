CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now(),
  processing_status TEXT NOT NULL DEFAULT 'processed' CHECK (processing_status IN ('processing', 'processed', 'ignored', 'failed')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type_processed
  ON stripe_webhook_events(event_type, processed_at DESC);
