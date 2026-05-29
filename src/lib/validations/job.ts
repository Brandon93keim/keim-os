import { z } from "zod"

export const jobEditSchema = z.object({
  job_number: z.string().min(1, "Job number required"),
  title: z.string().min(1, "Title required").max(200),
  description: z.string().max(2000).nullable(),
  total_estimate: z.number().nonnegative().nullable(),
  status: z.enum(["open", "completed", "cancelled", "pro_bono"]),
})

export type JobEditInput = z.input<typeof jobEditSchema>
export type JobEditValues = z.infer<typeof jobEditSchema>
