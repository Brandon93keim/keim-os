-- ============================================================
-- 0014_bills_with_next_due_view.sql
-- ============================================================

-- Avoids N+1 by pre-joining the next_due_date calculation.
-- security_invoker ensures the caller's RLS on bills is respected.
CREATE OR REPLACE VIEW bills_with_next_due
WITH (security_invoker = on)
AS
SELECT b.*, bill_next_due_date(b.id) AS next_due_date
FROM bills b;
