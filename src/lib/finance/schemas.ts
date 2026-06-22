import { z } from "zod"


export const accountFormSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(60, "Name must be 60 characters or fewer"),
    type: z.enum(["checking", "savings", "credit_card", "cash", "other"]),
    kind: z.enum(["asset", "liability"]),
    starting_balance: z.number().min(0, "Balance must be 0 or greater"),
    business_id: z.string().nullable(),
    is_active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (["checking", "savings", "cash"].includes(data.type) && data.kind !== "asset") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Checking, savings, and cash accounts must be assets",
        path: ["kind"],
      })
    }
    if (data.type === "credit_card" && data.kind !== "liability") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Credit card accounts must be liabilities",
        path: ["kind"],
      })
    }
  })

export type AccountFormValues = z.infer<typeof accountFormSchema>

export const transactionFormSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    account_id: z.string().uuid("Account is required"),
    transfer_to_account_id: z.string().uuid().nullable(),
    amount: z.number().positive("Amount must be greater than 0"),
    occurred_on: z.string().min(1, "Date is required"),
    description: z
      .string()
      .min(1, "Description is required")
      .max(200, "Description must be 200 characters or fewer"),
    business_id: z.string().nullable(),
    category_id: z.string().uuid().nullable(),
    notes: z
      .string()
      .max(500, "Notes must be 500 characters or fewer")
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "transfer") {
      if (data.category_id !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Category must be empty for transfers",
          path: ["category_id"],
        })
      }
      if (!data.transfer_to_account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Destination account is required for transfers",
          path: ["transfer_to_account_id"],
        })
      } else if (data.transfer_to_account_id === data.account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Destination must differ from source account",
          path: ["transfer_to_account_id"],
        })
      }
    } else {
      if (data.transfer_to_account_id !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Transfer to account must be empty for income/expense",
          path: ["transfer_to_account_id"],
        })
      }
    }
  })

export type TransactionFormValues = z.infer<typeof transactionFormSchema>

export const billFormSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or fewer"),
    business_id: z.string().nullable(),
    default_account_id: z.string().uuid("Account is required"),
    transaction_type: z.enum(["expense", "transfer"]),
    pays_down_account_id: z.string().uuid().nullable(),
    default_amount: z.number().positive("Amount must be greater than 0").nullable(),
    category_id: z.string().uuid().nullable(),
    frequency_unit: z.enum(["week", "month", "year"]),
    frequency_interval: z.number().int().positive("Interval must be greater than 0"),
    anchor_date: z.string().min(1, "Anchor date is required"),
    is_active: z.boolean(),
    notes: z.string().max(500, "Notes must be 500 characters or fewer").nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.transaction_type === "transfer") {
      if (!data.pays_down_account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Destination account is required for transfer bills",
          path: ["pays_down_account_id"],
        })
      } else if (data.pays_down_account_id === data.default_account_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Destination must differ from default account",
          path: ["pays_down_account_id"],
        })
      }
    } else {
      if (data.pays_down_account_id !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pays down account must be empty for expense bills",
          path: ["pays_down_account_id"],
        })
      }
    }
  })

export type BillFormValues = z.infer<typeof billFormSchema>

export const billPaymentFormSchema = z.object({
  bill_id: z.string().uuid("Bill is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  paid_on: z.string().min(1, "Date is required"),
  period_start: z.string().min(1, "Period start is required"),
  account_id: z.string().uuid("Account is required"),
  notes: z.string().max(500, "Notes must be 500 characters or fewer").nullable(),
})

export type BillPaymentFormValues = z.infer<typeof billPaymentFormSchema>

export const allocationRuleFormSchema = z.object({
  label: z.string().min(1, "Label is required").max(60, "Label must be 60 characters or fewer"),
  percentage: z
    .number()
    .positive("Percentage must be greater than 0")
    .max(100, "Percentage cannot exceed 100"),
  destination_account_id: z.string().uuid("Destination account is required"),
})

export type AllocationRuleFormValues = z.infer<typeof allocationRuleFormSchema>
