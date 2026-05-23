-- ============================================================
-- 0011_accounts_balance_view.sql
-- ============================================================

-- Avoids N+1 by pre-joining the balance calculation.
-- security_invoker ensures the caller's RLS on accounts is respected.
CREATE OR REPLACE VIEW accounts_with_balance
WITH (security_invoker = on)
AS
SELECT a.*, account_current_balance(a.id) AS current_balance
FROM accounts a;
