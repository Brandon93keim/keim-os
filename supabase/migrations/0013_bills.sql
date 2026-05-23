-- ============================================================
-- 0013_bills.sql
-- ============================================================


-- ============================================================
-- TABLE: bills
-- ============================================================
CREATE TABLE bills (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  business_id           text,
  default_account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  transaction_type      text NOT NULL CHECK (transaction_type IN ('expense','transfer')),
  pays_down_account_id  uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  default_amount        numeric(14,2) CHECK (default_amount > 0),
  category_id           uuid REFERENCES categories(id) ON DELETE SET NULL,
  frequency_unit        text NOT NULL CHECK (frequency_unit IN ('week','month','year')),
  frequency_interval    integer NOT NULL CHECK (frequency_interval > 0),
  anchor_date           date NOT NULL,
  end_date              date,
  is_active             boolean NOT NULL DEFAULT true,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bills_transfer_shape_check CHECK (
    (transaction_type = 'transfer'
      AND pays_down_account_id IS NOT NULL
      AND pays_down_account_id <> default_account_id)
    OR
    (transaction_type = 'expense' AND pays_down_account_id IS NULL)
  ),
  CONSTRAINT bills_end_date_check CHECK (
    end_date IS NULL OR end_date >= anchor_date
  )
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bills_select" ON bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bills_insert" ON bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bills_update" ON bills FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bills_delete" ON bills FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_bills
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX ON bills (user_id, is_active, anchor_date);
CREATE INDEX ON bills (user_id, default_account_id);


-- ============================================================
-- TABLE: bill_payments
-- ============================================================
CREATE TABLE bill_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id       uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount        numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_on       date NOT NULL,
  period_start  date NOT NULL,
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_payments_select" ON bill_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bill_payments_insert" ON bill_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bill_payments_update" ON bill_payments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bill_payments_delete" ON bill_payments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX ON bill_payments (user_id, bill_id, period_start DESC);
CREATE INDEX ON bill_payments (user_id, paid_on DESC);


-- ============================================================
-- BRIDGE: transactions.bill_payment_id
-- ============================================================
ALTER TABLE transactions
  ADD COLUMN bill_payment_id uuid UNIQUE
    REFERENCES bill_payments(id) ON DELETE CASCADE;

CREATE INDEX ON transactions (user_id, bill_payment_id) WHERE bill_payment_id IS NOT NULL;


-- ============================================================
-- FUNCTION: bill_next_due_date
-- ============================================================
CREATE OR REPLACE FUNCTION bill_next_due_date(p_bill_id uuid)
RETURNS date
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    CASE
      WHEN b.id IS NULL OR NOT b.is_active THEN NULL
      WHEN last_payment.period_start IS NULL THEN b.anchor_date
      WHEN b.end_date IS NOT NULL
        AND (last_payment.period_start
          + (b.frequency_interval || ' ' || b.frequency_unit)::interval)::date > b.end_date
        THEN NULL
      ELSE (last_payment.period_start
        + (b.frequency_interval || ' ' || b.frequency_unit)::interval)::date
    END
  FROM bills b
  LEFT JOIN (
    SELECT bill_id, MAX(period_start) AS period_start
    FROM bill_payments
    WHERE bill_id = p_bill_id
    GROUP BY bill_id
  ) last_payment ON last_payment.bill_id = b.id
  WHERE b.id = p_bill_id;
$$;
