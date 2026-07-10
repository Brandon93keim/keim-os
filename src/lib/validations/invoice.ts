import { z } from "zod"
import { BUSINESS_IDS } from "./client"

export const invoiceStatusSchema = z.enum([
  "draft", "sent", "partially_paid", "paid", "overdue", "cancelled", "void",
])

export const paymentMethodSchema = z.enum([
  "check", "cash", "ach", "credit_card", "venmo", "zelle", "paypal", "other",
])

export const PAYMENT_METHOD_LABELS: Record<z.infer<typeof paymentMethodSchema>, string> = {
  check: "Check",
  cash: "Cash",
  ach: "ACH Transfer",
  credit_card: "Credit Card",
  venmo: "Venmo",
  zelle: "Zelle",
  paypal: "PayPal",
  other: "Other",
}

export const DEFAULT_TERMS =
  "Late payments subject to 1.5% monthly interest."

export const DUE_TERM_LABELS: Record<'on_receipt' | 'net_15' | 'net_30' | 'custom', string> = {
  on_receipt: 'On Receipt',
  net_15: 'Net 15',
  net_30: 'Net 30',
  custom: 'Custom',
}

export const lineItemFormSchema = z.object({
  id: z.string().optional(),
  event_id: z.string().uuid().nullable(),
  description: z.string().min(1, "Required"),
  quantity: z.number().positive("Must be > 0"),
  unit_price: z.number().nonnegative(),
  unit_type: z.enum(['hourly', 'quantity', 'flat']).default('quantity'),
})

export const invoiceFormSchema = z
  .object({
    business_id: z.enum(BUSINESS_IDS, { message: "Select a business" }),
    client_id: z.string().uuid("Select a client"),
    job_id: z.string().uuid().nullable().optional(),
    issue_date: z.date(),
    due_date: z.date(),
    due_terms: z.enum(['on_receipt', 'net_15', 'net_30', 'custom']),
    tax_rate: z.number().min(0).max(100).default(0),
    discount_amount: z.number().nonnegative().default(0),
    notes: z.string().max(2000).optional(),
    terms: z.string().max(2000).optional(),
    email_address: z.string().email().or(z.literal("")).optional(),
    line_items: z.array(lineItemFormSchema).min(1, "Add at least one line item"),
  })
  .refine((d) => d.due_date >= d.issue_date, {
    message: "Due date must be on or after issue date",
    path: ["due_date"],
  })

export const paymentFormSchema = z.object({
  amount: z.number().positive("Amount must be greater than 0"),
  payment_date: z.date(),
  method: paymentMethodSchema,
  account_id: z.string().uuid("Select an account"),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>
export type InvoiceFormInput = z.input<typeof invoiceFormSchema>
export type LineItemFormValues = z.infer<typeof lineItemFormSchema>
export type LineItemFormInput = z.input<typeof lineItemFormSchema>
export type PaymentFormValues = z.infer<typeof paymentFormSchema>
