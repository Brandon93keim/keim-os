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
