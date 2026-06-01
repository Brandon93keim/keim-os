-- ============================================================
-- 0017_tasks.sql
-- ============================================================

-- PRE-FLIGHT (run separately before this migration):
--   SELECT count(*) FROM events WHERE type = 'reminder';

BEGIN;

-- ============================================================
-- TABLE: tasks
-- ============================================================
CREATE TABLE tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  notes        text,
  due_on       date,
  due_time     time,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  completed_at timestamptz,
  client_id    uuid REFERENCES clients(id) ON DELETE SET NULL,
  business_id  text,
  job_id       uuid REFERENCES jobs(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_due_time_requires_date_check CHECK (due_time IS NULL OR due_on IS NOT NULL)
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_tasks
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX ON tasks (user_id, status, due_on);
CREATE INDEX ON tasks (user_id, job_id) WHERE job_id IS NOT NULL;
CREATE INDEX ON tasks (user_id, client_id) WHERE client_id IS NOT NULL;

-- ============================================================
-- CONSOLIDATION: migrate reminder events → tasks, then delete
-- ============================================================
INSERT INTO tasks (user_id, title, notes, due_on, due_time, status,
                   client_id, business_id, job_id, created_at, updated_at)
SELECT
  user_id,
  title,
  description,
  (start_time AT TIME ZONE 'America/Chicago')::date,
  (start_time AT TIME ZONE 'America/Chicago')::time,
  'open',
  COALESCE(reminder_for_client_id, client_id),
  business_id,
  job_id,
  created_at,
  now()
FROM events
WHERE type = 'reminder';

DELETE FROM events WHERE type = 'reminder';

-- NOTE: 'reminder' is intentionally left in the events_type_check constraint
-- until the reminder UI is removed in a future cleanup migration.

COMMIT;
