-- ============================================================
-- Invoice numbering derived from job_number
--
-- An invoice created from a job derives its number from that job's
-- job_number, so deleting and recreating the invoice for the same job
-- reclaims the same clean number instead of burning a fresh counter.
-- ============================================================

-- ------------------------------------------------------------
-- Link invoices to their originating job
-- ------------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN job_id uuid REFERENCES jobs(id) ON DELETE SET NULL;

CREATE INDEX invoices_user_job_idx
  ON invoices (user_id, job_id)
  WHERE job_id IS NOT NULL;


-- ============================================================
-- FUNCTION: generate_invoice_number
--
--   p_job_id IS NULL  -> legacy per-business counter (ad-hoc invoices)
--   p_job_id NOT NULL -> derive base number from jobs.job_number, e.g.
--                        RWND-2026-1001  ->  RWND-INV-2026-1001
--                        (insert INV after the prefix), then de-dupe by
--                        appending -2, -3, ... for concurrent invoices.
-- ============================================================
CREATE OR REPLACE FUNCTION generate_invoice_number(
  p_business_id text,
  p_job_id      uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix     text;
  v_year       integer;
  v_number     integer;
  v_job_number text;
  v_base       text;
  v_candidate  text;
  n            integer;
BEGIN
  -- ----------------------------------------------------------
  -- Job-derived numbering
  -- ----------------------------------------------------------
  IF p_job_id IS NOT NULL THEN
    SELECT job_number INTO v_job_number
    FROM jobs
    WHERE id = p_job_id AND user_id = auth.uid();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Job % not found for current user', p_job_id;
    END IF;

    -- RWND-2026-1001 -> RWND-INV-2026-1001 (insert INV after the prefix)
    v_base := split_part(v_job_number, '-', 1)
      || '-INV-'
      || substring(v_job_number FROM position('-' IN v_job_number) + 1);

    -- First unused candidate: base, then base-2, base-3, ...
    n := 1;
    LOOP
      v_candidate := CASE WHEN n = 1 THEN v_base ELSE v_base || '-' || n::text END;

      IF NOT EXISTS (
        SELECT 1 FROM invoices
        WHERE user_id = auth.uid() AND invoice_number = v_candidate
      ) THEN
        RETURN v_candidate;
      END IF;

      n := n + 1;
    END LOOP;
  END IF;

  -- ----------------------------------------------------------
  -- Legacy per-business counter (ad-hoc invoices)
  -- ----------------------------------------------------------
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

  INSERT INTO invoice_counters (user_id, business_id, year, last_number)
  VALUES (auth.uid(), p_business_id, v_year, 1)
  ON CONFLICT (user_id, business_id, year)
  DO UPDATE SET
    last_number = invoice_counters.last_number + 1,
    updated_at  = now()
  RETURNING last_number INTO v_number;

  RETURN v_prefix || '-INV-' || v_year::text || '-' || lpad(v_number::text, 4, '0');
END;
$$;
