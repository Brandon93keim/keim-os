-- ============================================================
-- 0001_initial_schema.sql
-- ============================================================

-- ============================================================
-- TRIGGER FUNCTION: set_updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  email       text,
  phone       text,
  timezone    text NOT NULL DEFAULT 'America/Chicago',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (auth.uid() = id);

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TABLE: clients
-- ============================================================
CREATE TABLE clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  email         text,
  phone         text,
  company       text,
  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  postal_code   text,
  country       text NOT NULL DEFAULT 'US',
  status        text NOT NULL DEFAULT 'prospect'
                  CHECK (status IN ('prospect', 'active', 'archived')),
  notes         text,
  tags          text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select" ON clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_delete" ON clients FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_clients
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TABLE: client_businesses
-- ============================================================
CREATE TABLE client_businesses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  business_id text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, business_id)
);

ALTER TABLE client_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_businesses_select" ON client_businesses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "client_businesses_insert" ON client_businesses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "client_businesses_update" ON client_businesses FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "client_businesses_delete" ON client_businesses FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- TABLE: events
-- ============================================================
CREATE TABLE events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id      text,
  client_id        uuid REFERENCES clients(id) ON DELETE SET NULL,
  type             text NOT NULL CHECK (type IN ('meeting', 'job', 'personal')),
  meeting_purpose  text CHECK (
                     meeting_purpose IN ('prospect_meeting', 'existing_client', 'internal', 'personal')
                     OR meeting_purpose IS NULL
                   ),
  title            text NOT NULL,
  description      text,
  location         text,
  start_time       timestamptz NOT NULL,
  end_time         timestamptz NOT NULL,
  all_day          boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  job_number       text,
  job_total_amount numeric(12, 2),
  color_override   text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (type != 'job' OR business_id IS NOT NULL),
  CHECK (type != 'meeting' OR meeting_purpose IS NOT NULL)
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select" ON events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "events_update" ON events FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "events_delete" ON events FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_events
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TABLE: job_counters
-- ============================================================
CREATE TABLE job_counters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id text NOT NULL,
  year        integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, business_id, year)
);

ALTER TABLE job_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_counters_select" ON job_counters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "job_counters_insert" ON job_counters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "job_counters_update" ON job_counters FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "job_counters_delete" ON job_counters FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_job_counters
  BEFORE UPDATE ON job_counters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX ON events (user_id, start_time);
CREATE INDEX ON events (user_id, business_id, start_time);
CREATE INDEX ON events (user_id, type);
CREATE INDEX ON events (user_id, client_id);
CREATE INDEX ON clients (user_id, status);
CREATE INDEX ON clients (user_id, name);


-- ============================================================
-- FUNCTION: generate_job_number
-- ============================================================
CREATE OR REPLACE FUNCTION generate_job_number(p_business_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix  text;
  v_year    integer;
  v_number  integer;
BEGIN
  v_prefix := CASE p_business_id
    WHEN 'b-keim-rewind-marketing'    THEN 'RWND'
    WHEN 'happily-ever-after-weddings' THEN 'HEAW'
    WHEN 'remember-when-phone-booth'  THEN 'RWPB'
    WHEN 'brandon-keim-contract-work' THEN 'BKCW'
    WHEN 'brandon-keim-legal-work'    THEN 'BKLW'
    WHEN 'equipment-rental'           THEN 'RENT'
    WHEN 'keim-time'                  THEN 'KTME'
    ELSE upper(substring(p_business_id, 1, 4))
  END;

  v_year := extract(year FROM now())::integer;

  INSERT INTO job_counters (user_id, business_id, year, last_number)
  VALUES (auth.uid(), p_business_id, v_year, 1)
  ON CONFLICT (user_id, business_id, year)
  DO UPDATE SET
    last_number = job_counters.last_number + 1,
    updated_at  = now()
  RETURNING last_number INTO v_number;

  RETURN v_prefix || '-' || v_year::text || '-' || lpad(v_number::text, 4, '0');
END;
$$;


-- ============================================================
-- TRIGGER: auto-create profile on new user
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
