-- ============================================================
-- 0002_calendar_extensions.sql
-- ============================================================

-- New columns on events for recurring events and reminders
ALTER TABLE events
  ADD COLUMN rrule text,
  ADD COLUMN recurrence_end_date timestamptz,
  ADD COLUMN parent_event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  ADD COLUMN original_occurrence_date timestamptz,
  ADD COLUMN reminder_for_client_id uuid REFERENCES clients(id) ON DELETE CASCADE;

-- Drop old type check (did not include 'reminder')
ALTER TABLE events DROP CONSTRAINT events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check
  CHECK (type IN ('meeting', 'job', 'personal', 'reminder'));

-- Jobs cannot recur
ALTER TABLE events ADD CONSTRAINT jobs_no_recurrence
  CHECK (NOT (type = 'job' AND rrule IS NOT NULL));

-- ============================================================
-- TABLE: event_exceptions
-- ============================================================
CREATE TABLE event_exceptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id               uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  original_occurrence_date timestamptz NOT NULL,
  action                 text NOT NULL CHECK (action IN ('cancelled', 'modified')),
  modified_event_id      uuid REFERENCES events(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, original_occurrence_date)
);

ALTER TABLE event_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_exceptions_select" ON event_exceptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "event_exceptions_insert" ON event_exceptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "event_exceptions_update" ON event_exceptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "event_exceptions_delete" ON event_exceptions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX ON events (user_id, type, start_time);
CREATE INDEX ON events (user_id, parent_event_id);
CREATE INDEX ON event_exceptions (event_id);
