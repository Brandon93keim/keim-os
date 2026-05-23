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
    notes: z
      .string()
      .max(500, "Notes must be 500 characters or fewer")
      .nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "transfer") {
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
