"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useJobs } from "@/lib/hooks/useJobs"

interface Props {
  businessId: string | null
  value: string | null
  onChange: (jobId: string | null) => void
  disabled?: boolean
}

export function JobPicker({ businessId, value, onChange, disabled }: Props) {
  const { data: jobs = [] } = useJobs(
    businessId ? { business_id: businessId, status: "open" } : undefined
  )

  if (!businessId) {
    return (
      <Select disabled value="__new__">
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select a business first" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__new__">Select a business first</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  return (
    <Select
      disabled={disabled}
      value={value ?? "__new__"}
      onValueChange={(v) => onChange(v === "__new__" ? null : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__new__">Create new job</SelectItem>
        {jobs.map((job) => (
          <SelectItem key={job.id} value={job.id}>
            {job.job_number}{job.title ? ` · ${job.title}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
