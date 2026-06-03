"use client"

import { useMemo, useState } from "react"
import { Plus, Receipt, Search } from "lucide-react"
import Link from "next/link"
import { isPast, parseISO } from "date-fns"
import { useInvoices, useUnbilledJobs } from "@/lib/hooks/useInvoices"
import { getBusinessById } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InvoiceCard } from "./InvoiceCard"
import { InvoiceFormSheet } from "./InvoiceFormSheet"
import { UnbilledJobsList } from "./UnbilledJobsList"
import { CompedJobsList } from "./CompedJobsList"
import type { InvoiceSummary } from "@/lib/queries/invoices"
import type { UnbilledJob } from "@/lib/queries/jobs"

type StatusFilter = "all" | "unbilled" | "draft" | "sent" | "paid" | "overdue"
type SortKey = "issue_date" | "due_date" | "amount" | "status"

function ListSkeleton() {
  return (
    <div className="space-y-3 px-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-[96px] w-full rounded-xl" />
      ))}
    </div>
  )
}

function EmptyState({ onNew, filtered }: { onNew: () => void; filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 pt-20 text-center">
      <div className="rounded-full bg-muted p-4">
        <Receipt size={28} className="text-muted-foreground" />
      </div>
      {filtered ? (
        <>
          <p className="font-medium">No invoices match</p>
          <p className="text-sm text-muted-foreground">Try a different filter or search.</p>
        </>
      ) : (
        <>
          <p className="font-medium">No invoices yet</p>
          <p className="text-sm text-muted-foreground">Create your first invoice to get started.</p>
          <Button onClick={onNew} className="gap-2">
            <Plus size={16} />
            Create your first invoice
          </Button>
        </>
      )}
    </div>
  )
}

function filterAndSort(
  invoices: InvoiceSummary[],
  search: string,
  status: StatusFilter,
  sort: SortKey
): InvoiceSummary[] {
  let result = [...invoices]

  if (status !== "all" && status !== "unbilled") {
    if (status === "overdue") {
      result = result.filter(
        (inv) => inv.status === "sent" && isPast(parseISO(inv.due_date))
      )
    } else if (status === "sent") {
      result = result.filter(
        (inv) => inv.status === "sent" && !isPast(parseISO(inv.due_date))
      )
    } else {
      result = result.filter((inv) => inv.status === status)
    }
  }

  if (search.trim()) {
    const q = search.toLowerCase()
    result = result.filter(
      (inv) =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.client?.name.toLowerCase().includes(q) ||
        getBusinessById(inv.business_id)?.name.toLowerCase().includes(q)
    )
  }

  result.sort((a, b) => {
    switch (sort) {
      case "due_date":
        return parseISO(a.due_date).getTime() - parseISO(b.due_date).getTime()
      case "amount":
        return b.total - a.total
      case "status":
        return a.status.localeCompare(b.status)
      default:
        return parseISO(b.issue_date).getTime() - parseISO(a.issue_date).getTime()
    }
  })

  return result
}

export function InvoiceList() {
  const { data: invoices, isLoading, error } = useInvoices()
  const { data: unbilledJobs } = useUnbilledJobs()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sort, setSort] = useState<SortKey>("issue_date")
  const [createOpen, setCreateOpen] = useState(false)
  const [prefillJob, setPrefillJob] = useState<UnbilledJob | null>(null)

  const unbilledCount = unbilledJobs?.length ?? 0

  const filtered = useMemo(
    () => filterAndSort(invoices ?? [], search, statusFilter, sort),
    [invoices, search, statusFilter, sort]
  )

  const isFiltered = search.trim().length > 0 || (statusFilter !== "all" && statusFilter !== "unbilled")

  function handleClose() {
    setCreateOpen(false)
    setPrefillJob(null)
  }

  function handleCreateInvoiceFromJob(job: UnbilledJob) {
    setPrefillJob(job)
    setCreateOpen(true)
  }

  const isUnbilledTab = statusFilter === "unbilled"

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/invoices/templates"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Templates
            </Link>
            <Button size="sm" className="gap-1.5 h-9" onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              New
            </Button>
          </div>
        </div>

        {/* Search — hidden on Unbilled tab */}
        {!isUnbilledTab && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <Input
                placeholder="Search number, client, business…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {/* Filters row */}
        <div className="px-4 pb-3 flex gap-2">
          <Tabs
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            className="flex-1 min-w-0"
          >
            <div className="overflow-x-auto">
              <TabsList className="min-w-full w-max">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unbilled">
                  {unbilledCount > 0 ? `Unbilled · ${unbilledCount}` : "Unbilled"}
                </TabsTrigger>
                <TabsTrigger value="draft">Draft</TabsTrigger>
                <TabsTrigger value="sent">Sent</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="overdue">Overdue</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>

          {/* Sort — hidden on Unbilled tab */}
          {!isUnbilledTab && (
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-[120px] shrink-0 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="issue_date">Issue date</SelectItem>
                <SelectItem value="due_date">Due date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="py-3">
        {isUnbilledTab ? (
          <>
            <UnbilledJobsList onCreateInvoice={handleCreateInvoiceFromJob} />
            <CompedJobsList />
          </>
        ) : (
          <>
            {isLoading && <ListSkeleton />}

            {error && (
              <div className="px-4 py-8 text-center text-sm text-destructive">
                Failed to load invoices. Pull to refresh.
              </div>
            )}

            {!isLoading && !error && filtered.length === 0 && (
              <EmptyState onNew={() => setCreateOpen(true)} filtered={isFiltered} />
            )}

            {!isLoading && !error && filtered.length > 0 && (
              <div className="space-y-3 px-4">
                {filtered.map((inv) => (
                  <InvoiceCard key={inv.id} invoice={inv} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="fixed z-30 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          bottom: "calc(env(safe-area-inset-bottom) + 80px)",
          right: 16,
        }}
        aria-label="New invoice"
      >
        <Plus size={24} />
      </button>

      <InvoiceFormSheet
        open={createOpen}
        onClose={handleClose}
        prefillJob={prefillJob}
      />
    </>
  )
}
