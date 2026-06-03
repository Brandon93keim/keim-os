"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format, parseISO } from "date-fns"
import {
  ChevronDown, Download, Edit2, ExternalLink, MoreVertical,
  Send, Trash2, User, X,
} from "lucide-react"
import { useInvoice, useMarkInvoiceSent, useMarkInvoiceCancelled, useMarkInvoiceVoid, useDeleteInvoice, useDeletePayment } from "@/lib/hooks/useInvoices"
import { useProfile } from "@/lib/hooks/useProfile"
import { getEffectiveStatus } from "@/lib/invoiceStatus"
import { downloadInvoicePdf } from "@/lib/pdf"
import { getBusinessById } from "@/lib/constants"
import { PAYMENT_METHOD_LABELS, DUE_TERM_LABELS } from "@/lib/validations/invoice"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/layout/PageHeader"
import { InvoiceStatusBadge } from "./InvoiceStatusBadge"
import { InvoiceFormSheet } from "./InvoiceFormSheet"
import { RecordPaymentDialog } from "./RecordPaymentDialog"
import type { Invoice } from "@/lib/queries/invoices"

function DetailSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4">
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  )
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">{children}</div>
}

function MoneyRow({
  label, amount, large, dimmed, highlight,
}: {
  label: string; amount: number; large?: boolean; dimmed?: boolean; highlight?: boolean
}) {
  return (
    <div className={cn("flex items-center justify-between py-0.5", dimmed && "opacity-50")}>
      <span className={cn("text-sm", large && "text-base font-semibold")}>{label}</span>
      <span
        className={cn(
          "tabular-nums text-sm",
          large && "text-base font-bold",
          highlight && "text-primary font-bold"
        )}
      >
        ${amount.toFixed(2)}
      </span>
    </div>
  )
}

interface Props {
  invoiceId: string
}

export function InvoiceDetail({ invoiceId }: Props) {
  const router = useRouter()
  const { data: invoice, isLoading, error } = useInvoice(invoiceId)
  const { data: profile } = useProfile()

  const [editOpen, setEditOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const markSent = useMarkInvoiceSent()
  const markCancelled = useMarkInvoiceCancelled()
  const markVoid = useMarkInvoiceVoid()
  const deleteInvoice = useDeleteInvoice()
  const deletePayment = useDeletePayment(invoiceId)

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <DetailSkeleton />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="px-4 py-8 text-center text-sm text-destructive">
        Failed to load invoice.
      </div>
    )
  }

  const biz = getBusinessById(invoice.business_id)
  const amountDue = Math.max(0, invoice.total - invoice.amount_paid)
  const effectiveStatus = getEffectiveStatus(invoice)
  const isOverdue = effectiveStatus === "overdue"
  const canSend = invoice.status === "draft"
  const canPay = !["paid", "cancelled", "void"].includes(invoice.status)
  const canEdit = !["cancelled", "void"].includes(invoice.status)

  function handleDelete() {
    deleteInvoice.mutate(invoiceId, {
      onSuccess: () => router.replace("/invoices"),
    })
  }

  async function handleDownloadPdf() {
    if (!invoice || !biz || !profile) return
    try {
      setPdfLoading(true)
      await downloadInvoicePdf(
        invoice,
        invoice.line_items,
        invoice.payments,
        invoice.client ?? null,
        biz,
        profile,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PDF")
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <>
      <PageHeader
        title={
          <span className="font-mono text-sm font-semibold truncate">
            {invoice.invoice_number ?? "Draft"}
          </span>
        }
        backHref="/invoices"
        right={
          <div className="flex items-center gap-2 shrink-0">
            <InvoiceStatusBadge status={effectiveStatus} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-9 w-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                >
                  <MoreVertical size={20} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={() => setEditOpen(true)}>
                    <Edit2 size={14} className="mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {!["cancelled", "void", "paid"].includes(invoice.status) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => markCancelled.mutate(invoiceId)}
                      className="text-muted-foreground"
                    >
                      <X size={14} className="mr-2" />
                      Mark as cancelled
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => markVoid.mutate(invoiceId)}
                      className="text-muted-foreground"
                    >
                      <ChevronDown size={14} className="mr-2" />
                      Mark as void
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  <Trash2 size={14} className="mr-2" />
                  Delete invoice
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Scrollable content */}
      <div className="px-4 py-4 space-y-4 pb-32">

        {/* Summary */}
        <SectionCard>
          <SectionTitle>Summary</SectionTitle>
          <div className="space-y-3">
            {biz && (
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: biz.color }}
                >
                  {biz.name}
                </span>
              </div>
            )}
            {invoice.client && (
              <button
                type="button"
                onClick={() => router.push(`/clients/${invoice.client!.id}`)}
                className="flex items-center gap-2 text-sm w-full text-left active:opacity-70"
              >
                <User size={15} className="text-muted-foreground shrink-0" />
                <span className="font-medium">{invoice.client.name}</span>
                {invoice.client.company && (
                  <span className="text-muted-foreground">— {invoice.client.company}</span>
                )}
                <ExternalLink size={12} className="ml-auto text-muted-foreground" />
              </button>
            )}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                  Issue date
                </div>
                <div className="text-sm">{format(parseISO(invoice.issue_date), "MMMM d, yyyy")}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-0.5">
                  Due date
                </div>
                <div className={cn("text-sm", isOverdue && "text-red-600 font-medium")}>
                  {(invoice.due_terms ?? 'custom') === 'on_receipt'
                    ? "Due on receipt"
                    : (invoice.due_terms === 'net_15' || invoice.due_terms === 'net_30')
                      ? `${format(parseISO(invoice.due_date), "MMM d, yyyy")} · ${DUE_TERM_LABELS[invoice.due_terms]}`
                      : format(parseISO(invoice.due_date), "MMMM d, yyyy")
                  }
                  {isOverdue && " · Overdue"}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Line items */}
        <SectionCard>
          <SectionTitle>Line Items</SectionTitle>
          <div className="space-y-3">
            {invoice.line_items.map((item) => (
              <div key={item.id} className="pb-3 border-b border-border last:border-0 last:pb-0">
                <div className="text-sm font-medium">{item.description}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-muted-foreground">
                    {item.unit_type === 'hourly' && `${item.quantity} hrs × $${item.unit_price.toFixed(2)}`}
                    {item.unit_type === 'quantity' && `${item.quantity} × $${item.unit_price.toFixed(2)}`}
                  </div>
                  <div className="text-sm font-semibold tabular-nums">
                    ${item.amount.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Totals */}
        <SectionCard>
          <SectionTitle>Totals</SectionTitle>
          <div className="space-y-1">
            <MoneyRow label="Subtotal" amount={invoice.subtotal} />
            {invoice.tax_rate > 0 && (
              <MoneyRow label={`Tax (${invoice.tax_rate}%)`} amount={invoice.tax_amount} />
            )}
            {invoice.discount_amount > 0 && (
              <MoneyRow label="Discount" amount={-invoice.discount_amount} />
            )}
            <div className="border-t border-border my-2" />
            <MoneyRow label="Total" amount={invoice.total} large />
            {invoice.amount_paid > 0 && (
              <MoneyRow label="Amount paid" amount={invoice.amount_paid} dimmed />
            )}
            <MoneyRow
              label="Amount due"
              amount={amountDue}
              large
              highlight={amountDue > 0}
            />
          </div>
        </SectionCard>

        {/* Payments */}
        {invoice.payments.length > 0 && (
          <SectionCard>
            <SectionTitle>Payments</SectionTitle>
            <div className="space-y-3">
              {invoice.payments.map((pmt) => (
                <div key={pmt.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold tabular-nums">
                      ${pmt.amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(pmt.payment_date), "MMM d, yyyy")}
                      {" · "}
                      {PAYMENT_METHOD_LABELS[pmt.method as keyof typeof PAYMENT_METHOD_LABELS] ?? pmt.method}
                      {pmt.reference && ` #${pmt.reference}`}
                    </div>
                    {pmt.notes && (
                      <div className="text-xs text-muted-foreground mt-0.5">{pmt.notes}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeletePaymentId(pmt.id)}
                    className="shrink-0 text-destructive/60 hover:text-destructive p-1 rounded transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Notes */}
        {invoice.notes && (
          <SectionCard>
            <SectionTitle>Notes</SectionTitle>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </SectionCard>
        )}

        {/* Terms */}
        {invoice.terms && (
          <SectionCard>
            <SectionTitle>Terms</SectionTitle>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{invoice.terms}</p>
          </SectionCard>
        )}
      </div>

      {/* Sticky action footer — sits above BottomNav (h-14 + safe-area) */}
      <div
        className="fixed left-0 right-0 z-20 bg-background/95 backdrop-blur border-t border-border px-4 py-3 flex gap-3"
        style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
      >
        {canSend && (
          <Button
            variant="outline"
            className="flex-1 h-11 gap-2"
            onClick={() => markSent.mutate(invoiceId)}
            disabled={markSent.isPending}
          >
            <Send size={16} />
            Mark Sent
          </Button>
        )}
        {canPay && (
          <Button
            className="flex-1 h-11"
            onClick={() => setPaymentOpen(true)}
          >
            Record Payment
          </Button>
        )}
        {!canSend && !canPay && canEdit && (
          <Button
            variant="outline"
            className="flex-1 h-11 gap-2"
            onClick={() => setEditOpen(true)}
          >
            <Edit2 size={16} />
            Edit
          </Button>
        )}
        <Button
          variant="outline"
          className="h-11 gap-2"
          onClick={handleDownloadPdf}
          disabled={pdfLoading || !invoice}
        >
          <Download size={16} />
          {pdfLoading ? "Generating…" : "Download PDF"}
        </Button>
      </div>

      {/* Edit sheet */}
      <InvoiceFormSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        invoice={invoice}
      />

      {/* Record payment dialog */}
      <RecordPaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        invoiceId={invoiceId}
        amountDue={amountDue}
        businessId={invoice.business_id}
        invoiceNumber={invoice.invoice_number}
        clientName={invoice.client?.name ?? null}
      />

      {/* Delete invoice confirm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also delete all line items and payment records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete payment confirm */}
      <AlertDialog
        open={!!deletePaymentId}
        onOpenChange={(o) => { if (!o) setDeletePaymentId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove payment?</AlertDialogTitle>
            <AlertDialogDescription>
              The invoice totals will be recalculated automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletePaymentId) {
                  deletePayment.mutate(deletePaymentId, {
                    onSuccess: () => setDeletePaymentId(null),
                  })
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
