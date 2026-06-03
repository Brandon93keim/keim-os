"use client"

import { useState, useMemo } from "react"
import { Plus } from "lucide-react"
import { format, parseISO } from "date-fns"
import {
  useBills,
  useCommittedOutflowsThisMonth,
  useMonthBillPayments,
  useLatestPaymentPerBill,
} from "@/lib/hooks/useBills"
import { getBusinessById } from "@/lib/constants"
import { formatCurrency, getMonthBounds } from "@/lib/finance/format"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/layout/PageHeader"
import { MarkPaidDialog } from "./MarkPaidDialog"
import { BillFormSheet } from "./BillFormSheet"
import { MoneyCube } from "./MoneyCube"
import type { BillWithNextDue } from "@/lib/finance/types"
import type { RecordBillPaymentContext } from "@/lib/queries/bills"

function getToday(): string {
  return format(new Date(), "yyyy-MM-dd")
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

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  )
}

export function BillList() {
  const today = getToday()
  const { monthStart, monthEnd } = getMonthBounds(today)

  const { data: bills = [], isLoading: billsLoading } = useBills()
  const { data: outflows, isLoading: outflowsLoading } = useCommittedOutflowsThisMonth()
  const { data: monthPayments = [], isLoading: paymentsLoading } = useMonthBillPayments(monthStart, monthEnd)
  const { data: latestPayments = {}, isLoading: latestLoading } = useLatestPaymentPerBill()

  const [activeCtx, setActiveCtx] = useState<RecordBillPaymentContext | null>(null)
  const [formSheetOpen, setFormSheetOpen] = useState(false)
  const [editingBill, setEditingBill] = useState<BillWithNextDue | undefined>(undefined)

  // paid_on DESC order from query, so first encountered per bill is the most recent
  const paidMap = useMemo(() => {
    const m = new Map<string, { amount: number; paid_on: string }>()
    for (const p of monthPayments) {
      if (!m.has(p.bill_id)) {
        m.set(p.bill_id, { amount: Number(p.amount), paid_on: p.paid_on })
      }
    }
    return m
  }, [monthPayments])

  const { unpaid, paid } = useMemo(() => {
    const unpaid: BillWithNextDue[] = []
    const paid: BillWithNextDue[] = []

    for (const bill of bills) {
      if (paidMap.has(bill.id)) {
        paid.push(bill)
      } else {
        const d = bill.next_due_date
        if (d && d <= monthEnd) {
          unpaid.push(bill)
        }
      }
    }

    // Overdue first (next_due_date < today), then by date ascending
    unpaid.sort((a, b) => {
      const aOver = a.next_due_date! < today
      const bOver = b.next_due_date! < today
      if (aOver !== bOver) return aOver ? -1 : 1
      return a.next_due_date! < b.next_due_date! ? -1 : 1
    })

    return { unpaid, paid }
  }, [bills, paidMap, monthEnd, today])

  const allBills = useMemo(() => [...unpaid, ...paid], [unpaid, paid])

  const isLoading = billsLoading || outflowsLoading || paymentsLoading || latestLoading

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
      <PageHeader title="Bills" backHref="/money" />

      {/* Hero */}
      <div className="px-3 pt-3 pb-1">
        {outflowsLoading ? (
          <Skeleton className="h-[4.5rem] rounded-xl" />
        ) : (
          <div className="w-full rounded-xl bg-muted/60 px-4 py-3 flex flex-col items-center text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">This month</p>
            <p className="text-2xl font-bold tabular-nums mb-0.5">
              {formatCurrency(outflows?.total ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(outflows?.paid ?? 0)} paid · {formatCurrency(outflows?.remaining ?? 0)} remaining
              {(outflows?.variableCount ?? 0) > 0 && ` · +${outflows!.variableCount} variable`}
            </p>
          </div>
        )}
      </div>

      {/* Counter line */}
      {!isLoading && bills.length > 0 && (
        <div className="px-3 pt-2 pb-0 text-center text-xs">
          <span className="text-red-500 dark:text-red-400 font-medium">{unpaid.length} unpaid</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-green-600 dark:text-green-400 font-medium">{paid.length} paid</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 pb-6">
        {isLoading ? (
          <div className="px-3 mt-4">
            <GridSkeleton />
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
          <div className="px-3 mt-3">
            <div className="grid grid-cols-3 gap-2">
              {allBills.map((bill) => {
                const business = bill.business_id ? getBusinessById(bill.business_id) : null
                const payment = paidMap.get(bill.id)

                if (payment) {
                  // Paid bill
                  return (
                    <MoneyCube
                      key={bill.id}
                      label={bill.name}
                      value={
                        <span className="text-green-600 dark:text-green-400">
                          {formatCurrency(payment.amount)}
                        </span>
                      }
                      sublabel={`Paid ${format(parseISO(payment.paid_on), "MMM d")}`}
                      colorDot={business?.color}
                      className="ring-1 ring-green-500/40"
                      onClick={() => openEdit(bill)}
                    />
                  )
                }

                // Unpaid bill
                const isOverdue = bill.next_due_date! < today
                const sublabelDate = isOverdue
                  ? "Past due"
                  : `Due ${format(parseISO(bill.next_due_date!), "MMM d")}`

                let value: React.ReactNode
                let sublabel: string

                if (bill.default_amount != null) {
                  value = (
                    <span className="text-red-500 dark:text-red-400">
                      {formatCurrency(Number(bill.default_amount))}
                    </span>
                  )
                  sublabel = sublabelDate
                } else {
                  const est = latestPayments[bill.id]
                  if (est) {
                    value = (
                      <span className="text-red-500 dark:text-red-400">
                        {formatCurrency(est.amount)}
                      </span>
                    )
                    sublabel = sublabelDate
                  } else {
                    value = <span className="text-muted-foreground">TBD</span>
                    sublabel = sublabelDate
                  }
                }

                return (
                  <MoneyCube
                    key={bill.id}
                    label={bill.name}
                    value={value}
                    sublabel={sublabel}
                    colorDot={business?.color}
                    onClick={() => setActiveCtx(billToCtx(bill))}
                  />
                )
              })}
            </div>
          </div>
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
