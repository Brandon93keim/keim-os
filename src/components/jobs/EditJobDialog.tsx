"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  jobEditSchema,
  type JobEditInput,
  type JobEditValues,
} from "@/lib/validations/job"
import { useUpdateJob } from "@/lib/hooks/useJobs"
import type { JobSnapshot } from "@/lib/queries/events"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onClose: () => void
  job: JobSnapshot | null
}

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const

function buildDefaults(job: JobSnapshot | null): JobEditInput {
  return {
    job_number: job?.job_number ?? "",
    title: job?.title ?? "",
    description: job?.description ?? null,
    total_estimate: job?.total_estimate ?? null,
    status: job?.status ?? "open",
  }
}

export function EditJobDialog({ open, onClose, job }: Props) {
  const updateJob = useUpdateJob()

  const form = useForm<JobEditInput>({
    resolver: zodResolver(jobEditSchema),
    defaultValues: buildDefaults(job),
  })

  useEffect(() => {
    if (open) {
      form.reset(buildDefaults(job))
    }
  }, [open, job, form])

  function onSubmit(values: JobEditValues) {
    if (!job) return
    updateJob.mutate(
      { id: job.id, values },
      { onSuccess: () => onClose() }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="job_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. BKCW-2026-3001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Job title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes…"
                      rows={3}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="total_estimate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Estimate</FormLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className="pl-7"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? null : parseFloat(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    {STATUS_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => field.onChange(value)}
                        className={cn(
                          "flex-1 py-2 text-xs font-medium transition-colors",
                          field.value === value
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateJob.isPending}>
                {updateJob.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
