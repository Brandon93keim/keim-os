-- ============================================================
-- 0003_invoicing.sql
-- ============================================================


-- ============================================================
-- TABLE: invoice_counters
-- ============================================================
CREATE TABLE invoice_counters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id text NOT NULL,
  year        integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, business_id, year)
);

ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_counters_select" ON invoice_counters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoice_counters_insert" ON invoice_counters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoice_counters_update" ON invoice_counters FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoice_counters_delete" ON invoice_counters FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_invoice_counters
  BEFORE UPDATE ON invoice_counters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TABLE: invoices
-- ============================================================
CREATE TABLE invoices (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number   text,
  business_id      text NOT NULL,
  client_id        uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','sent','partially_paid','paid','overdue','cancelled','void')),
  issue_date       date NOT NULL DEFAULT current_date,
  due_date         date NOT NULL,
  subtotal         numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate         numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount       numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount  numeric(12,2) NOT NULL DEFAULT 0,
  total            numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid      numeric(12,2) NOT NULL DEFAULT 0,
  notes            text,
  terms            text,
  email_address    text,
  pdf_url          text,
  sent_at          timestamptz,
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (due_date >= issue_date),
  CHECK (amount_paid >= 0 AND amount_paid <= total + 0.01)
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoices_insert" ON invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_update" ON invoices FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_delete" ON invoices FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_invoices
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- TABLE: invoice_line_items
-- ============================================================
CREATE TABLE invoice_line_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id   uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_id     uuid REFERENCES events(id) ON DELETE SET NULL,
  description  text NOT NULL,
  quantity     numeric(10,2) NOT NULL DEFAULT 1,
  unit_price   numeric(12,2) NOT NULL DEFAULT 0,
  amount       numeric(12,2) NOT NULL DEFAULT 0,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_line_items_select" ON invoice_line_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoice_line_items_insert" ON invoice_line_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoice_line_items_update" ON invoice_line_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoice_line_items_delete" ON invoice_line_items FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- TABLE: payments
-- ============================================================
CREATE TABLE payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id    uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount        numeric(12,2) NOT NULL,
  payment_date  date NOT NULL DEFAULT current_date,
  method        text NOT NULL
                  CHECK (method IN ('check','cash','ach','credit_card','venmo','zelle','paypal','other')),
  reference     text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (amount > 0)
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payments_insert" ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payments_update" ON payments FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payments_delete" ON payments FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX ON invoices (user_id, status, due_date);
CREATE INDEX ON invoices (user_id, client_id);
CREATE INDEX ON invoices (user_id, business_id, issue_date);
CREATE INDEX ON invoice_line_items (invoice_id, sort_order);
CREATE INDEX ON invoice_line_items (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX ON payments (invoice_id, payment_date);


-- ============================================================
-- FUNCTION: generate_invoice_number
-- ============================================================
CREATE OR REPLACE FUNCTION generate_invoice_number(p_business_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix  text;
  v_year    integer;
  v_number  integer;
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

  v_year := extract(year FROM now())::integer;

  INSERT INTO invoice_counters (user_id, business_id, year, last_number)
  VALUES (auth.uid(), p_business_id, v_year, 1)
  ON CONFLICT (user_id, business_id, year)
  DO UPDATE SET
    last_number = invoice_counters.last_number + 1,
    updated_at  = now()
  RETURNING last_number INTO v_number;

  RETURN v_prefix || '-INV-' || v_year::text || '-' || lpad(v_number::text, 4, '0');
END;
$$;


-- ============================================================
-- FUNCTION: recalculate_invoice_state
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_invoice_state(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subtotal        numeric(12,2);
  v_tax_rate        numeric(5,2);
  v_discount_amount numeric(12,2);
  v_amount_paid     numeric(12,2);
  v_tax_amount      numeric(12,2);
  v_total           numeric(12,2);
  v_new_status      text;
  v_current_status  text;
BEGIN
  SELECT tax_rate, discount_amount, status
  INTO v_tax_rate, v_discount_amount, v_current_status
  FROM invoices WHERE id = p_invoice_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_subtotal
  FROM invoice_line_items WHERE invoice_id = p_invoice_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_amount_paid
  FROM payments WHERE invoice_id = p_invoice_id;

  v_tax_amount := round(v_subtotal * v_tax_rate / 100, 2);
  v_total      := v_subtotal + v_tax_amount - v_discount_amount;

  -- Status transitions: respect manual draft/cancelled/void;
  -- otherwise compute from payment state.
  IF v_current_status IN ('draft', 'cancelled', 'void') THEN
    v_new_status := v_current_status;
  ELSIF v_amount_paid >= v_total AND v_total > 0 THEN
    v_new_status := 'paid';
  ELSIF v_amount_paid > 0 THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := v_current_status;  -- keep 'sent' or 'overdue'
  END IF;

  UPDATE invoices
  SET subtotal        = v_subtotal,
      tax_amount      = v_tax_amount,
      total           = v_total,
      amount_paid     = v_amount_paid,
      status          = v_new_status,
      paid_at         = CASE
                          WHEN v_new_status = 'paid' AND paid_at IS NULL THEN now()
                          ELSE paid_at
                        END,
      updated_at      = now()
  WHERE id = p_invoice_id;
END;
$$;


-- ============================================================
-- TRIGGER FUNCTION: recalculate invoice on line item or payment change
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_recalc_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;
  PERFORM recalculate_invoice_state(v_invoice_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER recalc_on_line_item_change
  AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION trigger_recalc_invoice();

CREATE TRIGGER recalc_on_payment_change
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION trigger_recalc_invoice();
