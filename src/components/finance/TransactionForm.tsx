"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { cn } from "@/lib/utils"
import { transactionFormSchema, type TransactionFormValues } from "@/lib/finance/schemas"
import { useCreateTransaction, useUpdateTransaction, useDeleteTransaction } from "@/lib/hooks/useTransactions"
import { useAllAccounts } from "@/lib/hooks/useAccounts"
import { BUSINESSES } from "@/lib/constants"
import { format } from "date-fns"
import type { TransactionWithRelations } from "@/lib/finance/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DistributeDialog } from "./DistributeDialog"

const TYPE_OPTIONS = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "transfer", label: "Transfer" },
] as const

const ACCOUNT_LABEL: Record<string, string> = {
  income: "Deposited to",
  expense: "Paid from",
  transfer: "From account",
}

function todayISO() {
  return format(new Date(), "yyyy-MM-dd")
}

export type TransactionFormDefaults = {
  type?: "income" | "expense" | "transfer"
  account_id?: string
  transfer_to_account_id?: string
  description?: string
}

interface Props {
  transaction?: TransactionWithRelations
  defaults?: TransactionFormDefaults
  onSuccess: () => void
  onCancel: () => void
}

export function TransactionForm({ transaction, defaults, onSuccess, onCancel }: Props) {
  const createTransaction = useCreateTransaction()
  const updateTransaction = useUpdateTransaction()
  const deleteTransaction = useDeleteTransaction()
  const { data: accounts = [] } = useAllAccounts()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [distributeOpen, setDistributeOpen] = useState(false)

  const isSystemLinked = !!(
    transaction?.payment_id ||
    transaction?.bill_payment_id ||
    transaction?.invoice_id
  )
  const systemLinkLabel = transaction?.invoice_id
    ? "an invoice"
    : transaction?.payment_id
    ? "an invoice payment"
    : "a bill payment"

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: transaction
      ? {
          type: transaction.type,
          account_id: transaction.account_id,
          transfer_to_account_id: transaction.transfer_to_account_id,
          amount: Number(transaction.amount),
          occurred_on: transaction.occurred_on,
          description: transaction.description,
          business_id: transaction.business_id,
          notes: transaction.notes,
        }
      : {
          type: defaults?.type ?? "expense",
          account_id: defaults?.account_id ?? "",
          transfer_to_account_id: defaults?.transfer_to_account_id ?? null,
          amount: 0,
          occurred_on: todayISO(),
          description: defaults?.description ?? "",
          business_id: null,
          notes: null,
        },
  })

  const typeValue = form.watch("type")
  const accountIdValue = form.watch("account_id")
  const transferToIdValue = form.watch("transfer_to_account_id")
  const isSubmitting = form.formState.isSubmitting

  // When switching to/from transfer, clear transfer_to_account_id for non-transfer types
  useEffect(() => {
    if (typeValue !== "transfer") {
      form.setValue("transfer_to_account_id", null, { shouldValidate: false })
    }
  }, [typeValue, form])

  // Auto-populate business_id when account changes (if not editing an existing transaction)
  useEffect(() => {
    if (!accountIdValue) return
    const account = accounts.find((a) => a.id === accountIdValue)
    if (account?.business_id) {
      form.setValue("business_id", account.business_id, { shouldValidate: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIdValue, accounts])

  const transferToAccount = accounts.find((a) => a.id === transferToIdValue)
  const descriptionPlaceholder =
    typeValue === "transfer" && accountIdValue && transferToIdValue && transferToAccount
      ? `Transfer to ${transferToAccount.name}`
      : undefined

  const otherAccounts = accounts.filter((a) => a.id !== accountIdValue)

  async function onSubmit(values: TransactionFormValues) {
    // Ensure business_id is null for transfers regardless of hidden field
    const payload: TransactionFormValues = {
      ...values,
      transfer_to_account_id: values.type === "transfer" ? values.transfer_to_account_id : null,
      business_id: values.type === "transfer" ? null : values.business_id,
    }
    if (transaction) {
      updateTransaction.mutate({ id: transaction.id, values: payload }, { onSuccess })
    } else {
      createTransaction.mutate(payload, { onSuccess })
    }
  }

  function handleDelete() {
    if (!transaction) return
    deleteTransaction.mutate(transaction.id, { onSuccess })
  }

  return (
    <>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4 pb-6 space-y-5">

          {/* System-link notice */}
          {isSystemLinked && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              This transaction is linked to {systemLinkLabel} and must be edited or deleted there. Only description and notes can be changed here.
            </div>
          )}

          {/* Type — segmented control */}
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <FormControl>
                  <div className="flex rounded-lg border border-border bg-muted/40 p-1 gap-1">
                    {TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isSystemLinked}
                        onClick={() => field.onChange(opt.value)}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
                          field.value === opt.value
                            ? "bg-background shadow text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                          isSystemLinked && "cursor-not-allowed opacity-60"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Account */}
          <FormField
            control={form.control}
            name="account_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{ACCOUNT_LABEL[typeValue] ?? "Account"} *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ""} disabled={isSystemLinked}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {accounts.map((acct) => (
                      <SelectItem key={acct.id} value={acct.id}>
                        {acct.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Transfer to account (transfer only) */}
          {typeValue === "transfer" && (
            <FormField
              control={form.control}
              name="transfer_to_account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To account *</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v || null)}
                    value={field.value ?? ""}
                    disabled={isSystemLinked}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select destination" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {otherAccounts.map((acct) => (
                        <SelectItem key={acct.id} value={acct.id}>
                          {acct.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="pl-7"
                      disabled={isSystemLinked}
                      {...field}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        field.onChange(isNaN(v) ? 0 : v)
                      }}
                      value={field.value === 0 ? "" : field.value}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date */}
          <FormField
            control={form.control}
            name="occurred_on"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description *</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    placeholder={descriptionPlaceholder}
                    maxLength={200}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Business (hidden for transfer) */}
          {typeValue !== "transfer" && (
            <FormField
              control={form.control}
              name="business_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(v === "__personal__" ? null : v)}
                    value={field.value ?? "__personal__"}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__personal__">Personal / Shared</SelectItem>
                      {BUSINESSES.map((biz) => (
                        <SelectItem key={biz.id} value={biz.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: biz.color }}
                            />
                            {biz.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Notes */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    maxLength={500}
                    placeholder="Optional notes…"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Distribute funds — income only, editing only */}
          {transaction?.type === "income" && (
            <button
              type="button"
              onClick={() => setDistributeOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-sm font-medium hover:bg-muted/40 active:bg-muted/60 transition-colors"
            >
              <span>Distribute funds</span>
              <span className="text-muted-foreground text-xs">→</span>
            </button>
          )}

          {/* Delete confirm inline */}
          {showDeleteConfirm && !isSystemLinked && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 space-y-2">
              <p className="text-sm text-destructive">Delete this transaction? This cannot be undone.</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteTransaction.isPending}
                  className="flex-1"
                >
                  {deleteTransaction.isPending ? "Deleting…" : "Yes, delete"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1"
                >
                  Keep it
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div
          className="flex gap-3 border-t border-border bg-popover px-4 py-4 shrink-0"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          {transaction && !showDeleteConfirm && !isSystemLinked && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-11 px-4"
            >
              Delete
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 h-11"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1 h-11">
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Form>

    {transaction?.type === "income" && (
      <DistributeDialog
        open={distributeOpen}
        onClose={() => setDistributeOpen(false)}
        income={transaction}
      />
    )}
    </>
  )
}
