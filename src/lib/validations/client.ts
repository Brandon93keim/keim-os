import { z } from "zod"

export const BUSINESS_IDS = [
  "b-keim-rewind-marketing",
  "happily-ever-after-weddings",
  "remember-when-phone-booth",
  "brandon-keim-contract-work",
  "brandon-keim-legal-work",
  "equipment-rental",
  "keim-time",
] as const

export type BusinessId = (typeof BUSINESS_IDS)[number]

export const clientFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  status: z.enum(["prospect", "active", "archived"]),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(200).optional(),
  address_line1: z.string().max(200).optional(),
  address_line2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(2).default("US"),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).default([]),
  business_ids: z.array(z.enum(BUSINESS_IDS)).default([]),
})

export type ClientFormValues = z.infer<typeof clientFormSchema>
export type ClientFormInput = z.input<typeof clientFormSchema>
