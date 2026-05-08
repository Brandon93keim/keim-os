"use client"

import { differenceInCalendarDays, parseISO } from "date-fns"
import { getBusinessById } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { useUnbilledJobs } from "@/lib/hooks/useInvoices"
import type { UnbilledJob } from "@/lib/queries/jobs"

interface Props {
  onCreateInvoice: (job: UnbilledJob) => void
}

function jobAge(startTime: string): string {
  const days = differenceInCalendarDays(new Date(), parseISO(startTime))
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  return `${days} days ago`
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 px-4">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[96px] w-full rounded-xl" />
      ))}
    </div>
  )
}

export function UnbilledJobsList({ onCreateInvoice }: Props) {
  const { data: jobs, isLoading, error } = useUnbilledJobs()

  if (isLoading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="px-4 py-8 text-center text-sm text-destructive">
        Failed to load unbilled jobs.
      </div>
    )
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted-foreground">
        All caught up. No unbilled jobs.
      </div>
    )
  }

  return (
    <div className="space-y-3 px-4">
      {jobs.map((job) => {
        const biz = getBusinessById(job.business_id)
        return (
          <button
            key={job.id}
            type="button"
            onClick={() => onCreateInvoice(job)}
            className="w-full rounded-xl border border-border bg-card text-left overflow-hidden flex active:bg-muted/50 transition-colors"
          >
            {/* Left color stripe */}
            <div
              className="w-1.5 shrink-0"
              style={{ backgroundColor: biz?.color ?? "#94a3b8" }}
            />

            <div className="flex-1 p-4 min-w-0">
              {/* Top row: job number · business name */}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold">
                  {job.job_number ?? "—"}
                </span>
                {biz && (
                  <span className="text-xs text-muted-foreground truncate">
                    {biz.name}
                  </span>
                )}
              </div>

              {/* Title */}
              <div className="text-sm font-medium leading-snug line-clamp-1">
                {job.title}
              </div>

              {/* Bottom row: client · age · amount */}
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                  {job.client_name ? (
                    <span className="truncate">{job.client_name}</span>
                  ) : (
                    <span className="truncate italic">No client</span>
                  )}
                  <span className="shrink-0">·</span>
                  <span className="shrink-0">{jobAge(job.start_time)}</span>
                </div>
                <span className="text-sm font-bold tabular-nums shrink-0">
                  {job.job_total_amount != null
                    ? `$${job.job_total_amount.toFixed(2)}`
                    : "—"}
                </span>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
