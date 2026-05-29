"use client"

import { useState, useMemo } from "react"
import { ArrowLeft, Pencil, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { format, parseISO, addDays } from "date-fns"
import { useBills, useRecentBillPayments } from "@/lib/hooks/useBills"
import { getBusinessById } from "@/lib/constants"
import { formatCurrency, getMonthBounds } from "@/lib/finance/format"
import { Skeleton } from "@/components/ui/skeleton"
import { MarkPaidDialog } from "./MarkPaidDialog"
import { BillFormSheet } from "./BillFormSheet"
import type { BillWithNextDue } from "@/lib/finance/types"
import type { RecordBillPaymentContext } from "@/lib/queries/bills"

function getToday(): string {
  return format(new Date(), "yyyy-MM-dd")
}

function get60DayCutoff(today: string): string {
  return format(addDays(parseISO(today), 60), "yyyy-MM-dd")
}

function billToCtx(bill: BillWithNextDue): RecordBillPaymentContext {
  return {
    billId: bill.id,
    billName: bill.name,
    businessId: bill.business_id,
    transactionType: bill.transaction_type,
    paysDownAccountId: bill.pays_down_account_id,
    defaultAccountId: bill.default_account_id,
    defaultAmount: bill.default_amount != null ? Number(bill.default_amount) : null,
    nextDueDate: bill.next_due_date,
  }
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </p>
  )
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Skeleton className="h-2 w-2 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  )
}

function BillRow({
  bill,
  subtitle,
  onTap,
  onEdit,
}: {
  bill: BillWithNextDue
  subtitle: React.ReactNode
  onTap: () => void
  onEdit: () => void
}) {
  const business = bill.business_id ? getBusinessById(bill.business_id) : null

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={onTap}
        className="flex flex-1 items-center gap-3 px-4 py-3.5 text-left min-w-0 transition-colors active:bg-muted/60 hover:bg-muted/40"
      >
        {business ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: business.color }}
          />
        ) : (
          <span className="h-2 w-2 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{bill.name}</p>
          <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
        </div>

        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <p className="text-sm font-medium tabular-nums">
            {bill.default_amount != null
              ? formatCurrency(Number(bill.default_amount))
              : "Variable"}
          </p>
          <span className="text-xs text-primary">Mark paid</span>
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        aria-label={`Edit ${bill.name}`}
        className="flex h-12 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground transition-colors pr-3"
      >
        <Pencil size={16} />
      </button>
    </div>
  )
}

export function BillList() {
  const router = useRouter()
  const { data: bills = [], isLoading: billsLoading } = useBills()
  const { data: recentPayments = [], isLoading: paymentsLoading } = useRecentBillPayments(30)
  const [activeCtx, setActiveCtx] = useState<RecordBillPaymentContext | null>(null)
  const [formSheetOpen, setFormSheetOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<BillWithNextDue | undefined>(undefined)

  const today = getToday()
  const { monthStart, monthEnd } = getMonthBounds(today)
  const cutoff60 = get60DayCutoff(today)

  const billMap = useMemo(() => {
    const m = new Map<string, BillWithNextDue>()
    for (const b of bills) m.set(b.id, b)
    return m
  }, [bills])

  const { overdue, dueThisMonth, upcoming } = useMemo(() => {
    const overdue: BillWithNextDue[] = []
    const dueThisMonth: BillWithNextDue[] = []
    const upcoming: BillWithNextDue[] = []

    for (const bill of bills) {
      const d = bill.next_due_date
      if (!d) continue
      if (d < today) {
        overdue.push(bill)
      } else if (d <= monthEnd) {
        dueThisMonth.push(bill)
      } else if (d <= cutoff60) {
        upcoming.push(bill)
      }
    }
    return { overdue, dueThisMonth, upcoming }
  }, [bills, today, monthEnd, cutoff60])

  const { fixedCount, fixedSum, variableCount } = useMemo(() => {
    let fixedCount = 0
    let fixedSum = 0
    let variableCount = 0
    for (const bill of bills) {
      const d = bill.next_due_date
      if (!d || d < monthStart || d > monthEnd) continue
      if (bill.default_amount != null) {
        fixedCount++
        fixedSum += Number(bill.default_amount)
      } else {
        variableCount++
      }
    }
    return { fixedCount, fixedSum, variableCount }
  }, [bills, monthStart, monthEnd])

  const isLoading = billsLoading || paymentsLoading

  function openCreate() {
    setEditingBill(undefined)
    setFormSheetOpen(true)
  }

  function openEdit(bill: BillWithNextDue) {
    setEditingBill(bill)
    setFormSheetOpen(true)
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors -ml-1"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold">Bills</h1>
      </div>

      {/* Summary band */}
      <div className="bg-muted/40 border-b border-border px-4 py-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider text-center mb-3">
          Due this month
        </p>
        <div className="flex justify-around">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Bills</p>
            <p className="text-base font-semibold tabular-nums">
              {isLoading ? <Skeleton className="h-5 w-8 mx-auto" /> : fixedCount}
            </p>
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Total</p>
            <p className="text-base font-semibold tabular-nums">
              {isLoading ? <Skeleton className="h-5 w-20" /> : formatCurrency(fixedSum)}
            </p>
          </div>
        </div>
        {!isLoading && variableCount > 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            + {variableCount} variable
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        {isLoading ? (
          <div className="mt-4 divide-y divide-border border-y border-border">
            {[...Array(3)].map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        ) : bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 px-4 pt-20 text-center">
            <p className="text-base font-medium text-muted-foreground">No bills yet.</p>
            <button
              type="button"
              onClick={openCreate}
              className="text-sm font-medium text-primary hover:opacity-80 transition-opacity"
            >
              Add your first bill
            </button>
          </div>
        ) : (
          <>
            {/* Overdue */}
            {overdue.length > 0 && (
              <div className="mt-4">
                <SectionHeader label="Overdue" />
                <div className="divide-y divide-border border-y border-border">
                  {overdue.map((bill) => (
                    <BillRow
                      key={bill.id}
                      bill={bill}
                      subtitle={
                        <span className="text-red-500 dark:text-red-400">
                          Was due {format(parseISO(bill.next_due_date!), "MMM d")}
                        </span>
                      }
                      onTap={() => setActiveCtx(billToCtx(bill))}
                      onEdit={() => openEdit(bill)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Due this month */}
            {dueThisMonth.length > 0 && (
              <div className="mt-6">
                <SectionHeader label="Due this month" />
                <div className="divide-y divide-border border-y border-border">
                  {dueThisMonth.map((bill) => (
                    <BillRow
                      key={bill.id}
                      bill={bill}
                      subtitle={format(parseISO(bill.next_due_date!), "MMM d")}
                      onTap={() => setActiveCtx(billToCtx(bill))}
                      onEdit={() => openEdit(bill)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <div className="mt-6">
                <SectionHeader label="Upcoming" />
                <div className="divide-y divide-border border-y border-border">
                  {upcoming.map((bill) => (
                    <BillRow
                      key={bill.id}
                      bill={bill}
                      subtitle={format(parseISO(bill.next_due_date!), "MMM d")}
                      onTap={() => setActiveCtx(billToCtx(bill))}
                      onEdit={() => openEdit(bill)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recently paid (30 days) */}
            {recentPayments.length > 0 && (
              <div className="mt-6">
                <SectionHeader label="Recently paid (30 days)" />
                <div className="divide-y divide-border border-y border-border">
                  {recentPayments.map((payment) => {
                    const bill = billMap.get(payment.bill_id)
                    const business = bill?.business_id
                      ? getBusinessById(bill.business_id)
                      : null
                    return (
                      <div
                        key={payment.id}
                        className="flex items-center gap-3 px-4 py-3.5"
                      >
                        {business ? (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: business.color }}
                          />
                        ) : (
                          <span className="h-2 w-2 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {bill?.name ?? "Unknown bill"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Paid {format(parseISO(payment.paid_on), "MMM d")}
                          </p>
                        </div>
                        <p className="text-sm font-medium tabular-nums text-muted-foreground shrink-0">
                          {formatCurrency(Number(payment.amount))}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB — lifted above BottomNav */}
      <button
        type="button"
        onClick={openCreate}
        aria-label="Add bill"
        className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom) + 1rem)" }}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* Mark Paid Dialog */}
      {activeCtx && (
        <MarkPaidDialog
          open={true}
          onClose={() => setActiveCtx(null)}
          ctx={activeCtx}
        />
      )}

      {/* Bill form sheet (create / edit) */}
      <BillFormSheet
        open={formSheetOpen}
        onClose={() => setFormSheetOpen(false)}
        bill={editingBill}
      />
    </div>
  )
}
