-- ============================================================
-- 0022_taxes.sql
-- Quarterly estimated tax planning.
--   tax_settings : per-year inputs (filing status, last year's tax, retirement plans)
--   tax_payments : estimated tax payments sent to the IRS / Louisiana.
--                  Each payment also creates an expense transaction that is
--                  excluded from P&L (a tax payment is not a business expense).
-- ============================================================

BEGIN;

CREATE TABLE tax_settings (
  user_id                    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_year                   integer NOT NULL,
  filing_status              text NOT NULL DEFAULT 'single' CHECK (filing_status IN ('single', 'mfj')),
  prior_year_federal_tax     numeric(12,2),           -- total tax on last year's 1040
  prior_year_agi_over_150k   boolean NOT NULL DEFAULT false,
  solo401k_deferral          numeric(12,2) NOT NULL DEFAULT 0 CHECK (solo401k_deferral >= 0),
  solo401k_employer          numeric(12,2) NOT NULL DEFAULT 0 CHECK (solo401k_employer >= 0),
  roth_ira_planned           numeric(12,2) NOT NULL DEFAULT 0 CHECK (roth_ira_planned >= 0),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tax_year)
);

ALTER TABLE tax_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_settings_select" ON tax_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tax_settings_insert" ON tax_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tax_settings_update" ON tax_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tax_settings_delete" ON tax_settings FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER set_updated_at_tax_settings
  BEFORE UPDATE ON tax_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE tax_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_year        integer NOT NULL,
  jurisdiction    text NOT NULL CHECK (jurisdiction IN ('federal', 'louisiana')),
  paid_on         date NOT NULL,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  transaction_id  uuid REFERENCES transactions(id) ON DELETE SET NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON tax_payments (user_id, tax_year);
ALTER TABLE tax_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tax_payments_select" ON tax_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tax_payments_insert" ON tax_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tax_payments_update" ON tax_payments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tax_payments_delete" ON tax_payments FOR DELETE USING (auth.uid() = user_id);

COMMIT;
