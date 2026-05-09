-- Replace generate_job_number with per-business starting-number offsets.
-- GREATEST() in the ON CONFLICT clause advances any existing counter to the
-- offset on the next call without disturbing counters already past it.

CREATE OR REPLACE FUNCTION generate_job_number(p_business_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix    text;
  v_starting  integer;
  v_year      integer;
  v_number    integer;
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

  v_starting := CASE p_business_id
    WHEN 'happily-ever-after-weddings' THEN 1
    WHEN 'b-keim-rewind-marketing'    THEN 1001
    WHEN 'remember-when-phone-booth'  THEN 2001
    WHEN 'brandon-keim-contract-work' THEN 3001
    WHEN 'brandon-keim-legal-work'    THEN 4001
    WHEN 'equipment-rental'           THEN 5001
    WHEN 'keim-time'                  THEN 6001
    ELSE 1
  END;

  v_year := extract(year FROM now())::integer;

  INSERT INTO job_counters (user_id, business_id, year, last_number)
  VALUES (auth.uid(), p_business_id, v_year, v_starting)
  ON CONFLICT (user_id, business_id, year)
  DO UPDATE SET
    last_number = GREATEST(
      job_counters.last_number + 1,
      EXCLUDED.last_number
    ),
    updated_at = now()
  RETURNING last_number INTO v_number;

  RETURN v_prefix || '-' || v_year::text || '-'
         || lpad(v_number::text, 4, '0');
END;
$$;
