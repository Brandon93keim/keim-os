import { z } from "zod"
import { BUSINESS_IDS } from "./client"

export const taskFormSchema = z
  .object({
    title: z.string().min(1, "Required").max(200),
    notes: z.string().max(2000).nullable().optional(),
    due_on: z.date().nullable(),
    due_time: z.string().nullable(),
    client_id: z.string().uuid().nullable(),
    business_id: z.enum(BUSINESS_IDS).nullable(),
  })
  .superRefine((d, ctx) => {
    if (d.due_time != null && d.due_on == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Set a date first",
        path: ["due_time"],
      })
    }
  })

export type TaskFormValues = z.infer<typeof taskFormSchema>
export type TaskFormInput = z.input<typeof taskFormSchema>
