import { z } from "zod"
import { BUSINESS_IDS } from "./client"

export const eventTypeSchema = z.enum(["meeting", "job", "personal", "reminder", "golf"])
export const meetingPurposeSchema = z.enum([
  "prospect_meeting",
  "existing_client",
  "internal",
  "personal",
])
export const golfPurposeSchema = z.enum([
  "workout",
  "practice",
  "practice_round",
  "tournament",
])

export const eventFormSchema = z
  .object({
    type: eventTypeSchema,
    title: z.string().min(1, "Title required").max(200),
    business_id: z.enum(BUSINESS_IDS).nullable(),
    client_id: z.string().uuid().nullable(),
    meeting_purpose: meetingPurposeSchema.nullable(),
    golf_purpose: golfPurposeSchema.nullable(),
    start_time: z.date(),
    end_time: z.date(),
    all_day: z.boolean().default(false),
    location: z.string().max(500).optional(),
    description: z.string().max(5000).optional(),
    color_override: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable(),
    rrule: z.string().nullable(),
    recurrence_end_date: z.date().nullable(),
    reminder_for_client_id: z.string().uuid().nullable(),
    // UI-side: picker only shows jobs matching the selected business/client,
    // so cross-business consistency is enforced before submit (no async DB refine).
    linked_job_id: z.string().uuid().nullable().optional(),
  })
  .refine((d) => d.end_time > d.start_time, {
    message: "End time must be after start time",
    path: ["end_time"],
  })
  .refine((d) => d.type !== "job" || (d.business_id && d.client_id), {
    message: "Jobs require a business and client",
    path: ["client_id"],
  })
  .refine(
    (d) => d.type !== "meeting" || (d.business_id && d.meeting_purpose),
    {
      message: "Meetings require a business and purpose",
      path: ["meeting_purpose"],
    }
  )
  .refine(
    (data) => !(data.type === "job" && data.rrule !== null),
    { message: "Jobs cannot recur", path: ["rrule"] }
  )

export type EventFormValues = z.infer<typeof eventFormSchema>
export type EventFormInput = z.input<typeof eventFormSchema>
