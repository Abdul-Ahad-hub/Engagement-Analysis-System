-- Run once against the application's PostgreSQL database before deploying.
ALTER TABLE engagement_records
  ADD COLUMN IF NOT EXISTS source varchar NOT NULL DEFAULT 'cloud',
  ADD COLUMN IF NOT EXISTS "resultId" varchar,
  ADD COLUMN IF NOT EXISTS prediction jsonb;

ALTER TABLE engagement_sessions
  ADD COLUMN IF NOT EXISTS mode varchar,
  ADD COLUMN IF NOT EXISTS routing jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_engagement_records_result_id
  ON engagement_records ("resultId")
  WHERE "resultId" IS NOT NULL;
