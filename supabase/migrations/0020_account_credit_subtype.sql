-- ============================================================
-- 0020_account_credit_subtype.sql
-- Splits credit cards into financing plans and revolving cards.
--
-- A financing plan pays down on a fixed schedule, so its recorded balance is
-- accurate. A revolving card only ever gets payments recorded against it —
-- day-to-day charges are never entered — so its balance drifts and has to be
-- reconciled against a statement.
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN credit_subtype text
    CHECK (credit_subtype IN ('financing','revolving'));

-- Only credit cards carry a subtype. Nullable for credit cards too, so the
-- cards that already exist stay valid until they're tagged.
ALTER TABLE accounts
  ADD CONSTRAINT accounts_credit_subtype_shape_check CHECK (
    credit_subtype IS NULL OR type = 'credit_card'
  );

-- The view's `a.*` was expanded into a fixed column list when it was created,
-- so the new column is invisible until it's rebuilt. CREATE OR REPLACE can't do
-- it — credit_subtype lands before current_balance, and replacing a view may
-- only append columns — so drop and recreate.
DROP VIEW IF EXISTS accounts_with_balance;

CREATE VIEW accounts_with_balance
WITH (security_invoker = on)
AS
SELECT a.*, account_current_balance(a.id) AS current_balance
FROM accounts a;
