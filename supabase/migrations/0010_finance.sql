-- ============================================================
-- 0010_finance.sql
-- ============================================================


-- ============================================================
-- TABLE: accounts
-- ============================================================
CREATE TABLE accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text NOT NULL,
  type             text NOT NULL CHECK (type IN ('checking','savings','credit_card','cash','other')),
  kind             text NOT NULL CHECK (kind IN ('asset','liability')),
  starting_balance numeric(14,2) NOT NULL DEFAULT 0,
  business_id      text,
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts_select" ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts_insert" ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_update" ON accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_delete" ON accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_accounts
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX ON accounts (user_id, sort_order);


-- ============================================================
-- TABLE: categories
-- ============================================================
CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('income','expense','transfer')),
  parent_id   uuid REFERENCES categories(id) ON DELETE SET NULL,
  color       text,
  icon        text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX ON categories (user_id, kind, sort_order);


-- ============================================================
-- TABLE: transactions
-- ============================================================
CREATE TABLE transactions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id              uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  transfer_to_account_id  uuid REFERENCES accounts(id) ON DELETE RESTRICT,
  type                    text NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount                  numeric(14,2) NOT NULL CHECK (amount > 0),
  occurred_on             date NOT NULL,
  description             text NOT NULL,
  business_id             text,
  category_id             uuid REFERENCES categories(id) ON DELETE SET NULL,
  invoice_id              uuid REFERENCES invoices(id) ON DELETE SET NULL,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transactions_transfer_shape_check CHECK (
    (type = 'transfer' AND transfer_to_account_id IS NOT NULL AND transfer_to_account_id <> account_id)
    OR
    (type IN ('income','expense') AND transfer_to_account_id IS NULL)
  )
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update" ON transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_delete" ON transactions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_transactions
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX ON transactions (user_id, account_id, occurred_on DESC);
CREATE INDEX ON transactions (user_id, business_id, occurred_on DESC) WHERE business_id IS NOT NULL;
CREATE INDEX ON transactions (user_id, invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX ON transactions (user_id, type, occurred_on DESC);
CREATE INDEX ON transactions (transfer_to_account_id) WHERE transfer_to_account_id IS NOT NULL;


-- ============================================================
-- FUNCTION: account_current_balance
-- ============================================================
CREATE OR REPLACE FUNCTION account_current_balance(p_account_id uuid)
RETURNS numeric
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    a.starting_balance
    + COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'income'), 0)
    - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'expense'), 0)
    + COALESCE((SELECT SUM(amount) FROM transactions WHERE transfer_to_account_id = a.id AND type = 'transfer'), 0)
    - COALESCE((SELECT SUM(amount) FROM transactions WHERE account_id = a.id AND type = 'transfer'), 0)
  FROM accounts a
  WHERE a.id = p_account_id;
$$;
