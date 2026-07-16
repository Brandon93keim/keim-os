-- ============================================================
-- Let draft invoices with payments resolve to paid / partially_paid
--
-- recalculate_invoice_state previously froze status for 'draft',
-- 'cancelled', and 'void'. Freezing 'draft' meant a payment recorded
-- against a draft updated amount_paid but never transitioned the invoice
-- out of draft. Drop 'draft' from the frozen guard so only 'cancelled'
-- and 'void' stay pinned; drafts with payments now resolve like any
-- other invoice. (App layer marks drafts sent before payment; this is a
-- backstop for any that slip through.)
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

  -- Status transitions: respect manual cancelled/void;
  -- otherwise compute from payment state.
  IF v_current_status IN ('cancelled', 'void') THEN
    v_new_status := v_current_status;
  ELSIF v_amount_paid >= v_total AND v_total > 0 THEN
    v_new_status := 'paid';
  ELSIF v_amount_paid > 0 THEN
    v_new_status := 'partially_paid';
  ELSE
    v_new_status := v_current_status;  -- keep 'draft', 'sent', or 'overdue'
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
