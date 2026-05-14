BEGIN;

-- ===== New jobs table =====
CREATE TABLE jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id     text NOT NULL,
  client_id       uuid REFERENCES clients(id) ON DELETE SET NULL,
  job_number      text NOT NULL,
  title           text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'open',
  total_estimate  numeric(10,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jobs_status_check
    CHECK (status IN ('open', 'completed', 'cancelled')),
  CONSTRAINT jobs_user_number_unique
    UNIQUE (user_id, job_number)
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_select" ON jobs FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "jobs_insert" ON jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "jobs_update" ON jobs FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "jobs_delete" ON jobs FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_jobs
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX ON jobs (user_id, business_id);
CREATE INDEX ON jobs (user_id, client_id);
CREATE INDEX ON jobs (user_id, status);

-- ===== Add FK from events to jobs =====
ALTER TABLE events ADD COLUMN job_id uuid
  REFERENCES jobs(id) ON DELETE SET NULL;

CREATE INDEX ON events (job_id);

-- ===== Migrate existing data =====
-- For each event with a job_number, create a corresponding job row.
INSERT INTO jobs (
  user_id, business_id, client_id, job_number, title,
  total_estimate, status, created_at
)
SELECT
  user_id,
  business_id,
  client_id,
  job_number,
  title,
  job_total_amount,
  'open',
  created_at
FROM events
WHERE type = 'job'
  AND job_number IS NOT NULL
  AND business_id IS NOT NULL;

-- Link each event to its newly-created job
UPDATE events e
SET job_id = j.id
FROM jobs j
WHERE e.type = 'job'
  AND e.job_number IS NOT NULL
  AND j.user_id = e.user_id
  AND j.job_number = e.job_number;

-- ===== Drop now-redundant columns from events =====
ALTER TABLE events DROP COLUMN job_number;
ALTER TABLE events DROP COLUMN job_total_amount;

-- ===== Enforce that job-type events must link to a job =====
ALTER TABLE events ADD CONSTRAINT events_job_must_link
  CHECK (type != 'job' OR job_id IS NOT NULL);

-- ===== New RPC: create a job atomically (number + row) =====
CREATE OR REPLACE FUNCTION create_job(
  p_business_id     text,
  p_client_id       uuid,
  p_title           text,
  p_description     text DEFAULT NULL,
  p_total_estimate  numeric DEFAULT NULL
)
RETURNS jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_number text;
  v_new_job jobs;
BEGIN
  v_job_number := generate_job_number(p_business_id);

  INSERT INTO jobs (
    user_id, business_id, client_id, job_number, title,
    description, total_estimate
  )
  VALUES (
    auth.uid(), p_business_id, p_client_id, v_job_number, p_title,
    p_description, p_total_estimate
  )
  RETURNING * INTO v_new_job;

  RETURN v_new_job;
END;
$$;

COMMIT;
