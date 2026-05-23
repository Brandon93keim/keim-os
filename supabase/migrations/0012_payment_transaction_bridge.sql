-- ============================================================
-- 0012_payment_transaction_bridge.sql
-- Link transactions to payments for invoice payment → finance bridge
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN payment_id uuid UNIQUE
    REFERENCES payments(id) ON DELETE CASCADE;

CREATE INDEX ON transactions (user_id, payment_id) WHERE payment_id IS NOT NULL;
