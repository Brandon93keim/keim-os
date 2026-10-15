-- ============================================================
-- 0025_job_number_skip_taken.sql
-- generate_job_number now skips numbers that are already in use
-- (e.g. a job number edited by hand) instead of failing with
-- jobs_user_number_unique, and counters behind an existing job are repaired.
-- Applied to production on 2026-10-15.
-- ============================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.generate_job_number(p_business_id text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_prefix    text;
  v_starting  integer;
  v_year      integer;
  v_number    integer;
  v_candidate text;
BEGIN
  v_prefix := CASE p_business_id
    WHEN 'b-keim-rewind-marketing'    THEN 'RWND'
    WHEN 'happily-ever-after-weddings' THEN 'HEAW'
    WHEN 'remember-when-phone-booth'  THEN 'RWPB'
    WHEN 'brandon-keim-contract-work' THEN 'BKCW'
    WHEN 'brandon-keim-legal-work'    THEN 'BKLW'
    WHEN 'equipment-rental'           THEN 'RENT'
    WHEN 'keim-time'                  THEN 'KTME'
    WHEN 'keim-golf'                  THEN 'KGLF'
    ELSE upper(substring(p_business_id, 1, 4))
  END;

  v_starting := CASE p_business_id
    WHEN 'happily-ever-after-weddings' THEN 1
    WHEN 'b-keim-rewind-marketing'    THEN 1001
    WHEN 'remember-when-phone-booth'  THEN 2001
    WHEN 'brandon-keim-contract-work' THEN 3001
    WHEN 'brandon-keim-legal-work'    THEN 4001
    WHEN 'equipment-rental'           THEN 5001
    WHEN 'keim-time'                  THEN 6001
    WHEN 'keim-golf'                  THEN 5001
    ELSE 1
  END;

  v_year := extract(year FROM now())::integer;

  INSERT INTO job_counters (user_id, business_id, year, last_number)
  VALUES (auth.uid(), p_business_id, v_year, v_starting)
  ON CONFLICT (user_id, business_id, year)
  DO UPDATE SET
    last_number = GREATEST(job_counters.last_number + 1, EXCLUDED.last_number),
    updated_at = now()
  RETURNING last_number INTO v_number;

  LOOP
    v_candidate := v_prefix || '-' || v_year::text || '-' || lpad(v_number::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM jobs WHERE user_id = auth.uid() AND job_number = v_candidate
    );
    v_number := v_number + 1;
  END LOOP;

  UPDATE job_counters
  SET last_number = v_number, updated_at = now()
  WHERE user_id = auth.uid() AND business_id = p_business_id AND year = v_year
    AND last_number < v_number;

  RETURN v_candidate;
END;
$function$;

UPDATE job_counters c
SET last_number = sub.max_n, updated_at = now()
FROM (
  SELECT j.user_id, j.business_id,
         split_part(j.job_number, '-', 2)::int AS yr,
         max(split_part(j.job_number, '-', 3)::int) AS max_n
  FROM jobs j
  WHERE j.job_number ~ '^[A-Z]+-\d{4}-\d+$'
  GROUP BY 1, 2, 3
) sub
WHERE c.user_id = sub.user_id AND c.business_id = sub.business_id AND c.year = sub.yr
  AND c.last_number < sub.max_n;

COMMIT;
