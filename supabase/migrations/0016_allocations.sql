-- ============================================================
-- 0016_allocations.sql
-- ============================================================


-- ============================================================
-- TABLE: allocation_rules
-- ============================================================
CREATE TABLE allocation_rules (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label                  text NOT NULL,
  destination_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  percentage             numeric(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  sort_order             integer NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE allocation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allocation_rules_select" ON allocation_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "allocation_rules_insert" ON allocation_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "allocation_rules_update" ON allocation_rules FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "allocation_rules_delete" ON allocation_rules FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_allocation_rules
  BEFORE UPDATE ON allocation_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX ON allocation_rules (user_id, sort_order);


-- ============================================================
-- ALTER: transactions — source_transaction_id for Prompt B idempotency/undo
-- ============================================================
ALTER TABLE transactions
  ADD COLUMN source_transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE;

CREATE INDEX ON transactions (source_transaction_id) WHERE source_transaction_id IS NOT NULL;
