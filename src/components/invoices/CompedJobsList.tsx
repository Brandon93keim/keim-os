"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { getBusinessById } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/finance/format"
import { useProBonoJobsYTD } from "@/lib/hooks/useInvoices"

export function CompedJobsList() {
  const { data: jobs, isLoading } = useProBonoJobsYTD()
  const [open, setOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="px-4 mt-6">
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>
    )
  }

  if (!jobs || jobs.length === 0) return null

  const compedTotal = jobs.reduce((sum, job) => sum + (job.total_estimate ?? 0), 0)

  return (
    <div className="px-4 mt-6 pb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5 font-medium">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Comped
        </span>
        <span className="tabular-nums text-xs">
          {formatCurrency(compedTotal)} this year
        </span>
      </button>

      {open && (
        <div className="space-y-2 mt-2">
          {jobs.map((job) => {
            const biz = getBusinessById(job.business_id)
            return (
              <div
                key={job.job_id}
                className="rounded-xl border border-border bg-card overflow-hidden flex"
              >
                <div
                  className="w-1.5 shrink-0"
                  style={{ backgroundColor: biz?.color ?? "#94a3b8" }}
                />
                <div className="flex-1 px-4 py-3 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="font-mono font-bold text-sm">{job.job_number}</span>
                    {biz && (
                      <span className="text-xs text-muted-foreground truncate">{biz.name}</span>
                    )}
                  </div>
                  <div className="text-sm font-medium leading-snug line-clamp-1">
                    {job.job_title}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-muted-foreground truncate">
                      {job.client_company ?? job.client_name ?? "No client"}
                    </span>
                    <span className="text-sm font-semibold tabular-nums shrink-0 ml-2 text-muted-foreground">
                      {job.total_estimate != null ? formatCurrency(job.total_estimate) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
