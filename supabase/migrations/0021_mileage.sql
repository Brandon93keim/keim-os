-- ============================================================
-- 0021_mileage.sql
-- Business mileage log for the IRS standard mileage deduction.
--   mileage_settings : home base (start/end of every day's route)
--   geocode_cache    : address -> coordinates, so each place is looked up once
--   mileage_trips    : one row per business stop (calendar event or manual)
-- A day's job/meeting events are chained home -> stop1 -> ... -> home.
-- Each stop carries the leg that reached it; the last stop also carries the
-- drive home, so per-stop miles sum to the real route for the day.
-- ============================================================

BEGIN;

CREATE TABLE mileage_settings (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  home_address   text NOT NULL,
  home_lat       double precision NOT NULL,
  home_lng       double precision NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mileage_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mileage_settings_select" ON mileage_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mileage_settings_insert" ON mileage_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mileage_settings_update" ON mileage_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mileage_settings_delete" ON mileage_settings FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at_mileage_settings
  BEFORE UPDATE ON mileage_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE geocode_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query        text NOT NULL,              -- normalized (trimmed, lowercased) location text
  lat          double precision,           -- null = lookup failed (cached so we don't retry forever)
  lng          double precision,
  label        text,
  precision    text NOT NULL DEFAULT 'exact' CHECK (precision IN ('exact', 'approximate', 'failed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, query)
);

ALTER TABLE geocode_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geocode_cache_select" ON geocode_cache FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "geocode_cache_insert" ON geocode_cache FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "geocode_cache_update" ON geocode_cache FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "geocode_cache_delete" ON geocode_cache FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE mileage_trips (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_date         date NOT NULL,
  business_id       text,
  event_id          uuid REFERENCES events(id) ON DELETE SET NULL,
  job_id            uuid REFERENCES jobs(id) ON DELETE SET NULL,
  purpose           text NOT NULL,          -- IRS log: business purpose
  destination       text NOT NULL,          -- IRS log: where you went
  from_label        text,                   -- previous stop on the route ("Home" or a stop)
  miles             numeric(8,1) NOT NULL DEFAULT 0 CHECK (miles >= 0),
  includes_return   boolean NOT NULL DEFAULT false,  -- this stop also carries the drive home
  source            text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  status            text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'review', 'excluded')),
  review_reason     text,
  miles_overridden  boolean NOT NULL DEFAULT false, -- user edited miles; sync won't overwrite
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- One auto row per calendar event.
CREATE UNIQUE INDEX mileage_trips_event_unique ON mileage_trips (user_id, event_id) WHERE event_id IS NOT NULL;
CREATE INDEX ON mileage_trips (user_id, trip_date);

ALTER TABLE mileage_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mileage_trips_select" ON mileage_trips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mileage_trips_insert" ON mileage_trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mileage_trips_update" ON mileage_trips FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mileage_trips_delete" ON mileage_trips FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at_mileage_trips
  BEFORE UPDATE ON mileage_trips FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
