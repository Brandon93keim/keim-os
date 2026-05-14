"use client"

import { format, parseISO } from "date-fns"
import { getBusinessById } from "@/lib/constants"
import { Skeleton } from "@/components/ui/skeleton"
import { useUnbilledJobs } from "@/lib/hooks/useInvoices"
import type { UnbilledJob } from "@/lib/queries/jobs"

interface Props {
  onCreateInvoice: (job: UnbilledJob) => void
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
        const eventCount = job.unbilled_events.length
        const dateLabel =
          eventCount === 1
            ? format(parseISO(job.oldest_unbilled_date), "MMM d, yyyy")
            : `${eventCount} unbilled events · oldest ${format(parseISO(job.oldest_unbilled_date), "MMM d")}`

        return (
          <button
            key={job.job_id}
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
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="font-mono font-bold text-sm">
                  {job.job_number}
                </span>
                {biz && (
                  <span className="text-xs text-muted-foreground truncate">
                    {biz.name}
                  </span>
                )}
              </div>

              {/* Job title */}
              <div className="text-sm font-medium leading-snug line-clamp-1">
                {job.job_title}
              </div>

              {/* Client */}
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {job.client_company ?? job.client_name ?? "No client"}
              </div>

              {/* Bottom row: date label · estimate */}
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">
                  {dateLabel}
                </span>
                {job.total_estimate != null && (
                  <span className="text-sm font-semibold tabular-nums shrink-0 ml-2">
                    ${job.total_estimate.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
