ALTER TABLE invoices
  ADD COLUMN due_terms text NOT NULL DEFAULT 'custom'
  CONSTRAINT invoices_due_terms_check CHECK (due_terms IN ('on_receipt','net_15','net_30','custom'));

UPDATE invoices SET due_terms = CASE
  WHEN due_date = issue_date THEN 'on_receipt'
  WHEN due_date = issue_date + INTERVAL '15 days' THEN 'net_15'
  WHEN due_date = issue_date + INTERVAL '30 days' THEN 'net_30'
  ELSE 'custom'
END;
