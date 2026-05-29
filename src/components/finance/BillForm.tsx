"use client"

import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { cn } from "@/lib/utils"
import { billFormSchema, type BillFormValues } from "@/lib/finance/schemas"
import { useCreateBill, useUpdateBill, useDeleteBill } from "@/lib/hooks/useBills"
import { useAllAccounts } from "@/lib/hooks/useAccounts"
import { BUSINESSES } from "@/lib/constants"
import type { BillWithNextDue } from "@/lib/finance/types"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormDescription,
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

function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd")
}

interface Props {
  bill?: BillWithNextDue
  onSuccess: () => void
  onCancel: () => void
}

export function BillForm({ bill, onSuccess, onCancel }: Props) {
  const createBill = useCreateBill()
  const updateBill = useUpdateBill()
  const deleteBill = useDeleteBill()
  const { data: accounts = [] } = useAllAccounts()

  const [amountMode, setAmountMode] = useState<"fixed" | "variable">(
    bill ? (bill.default_amount != null ? "fixed" : "variable") : "fixed"
  )
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const assetAccounts = useMemo(
    () => accounts.filter((a) => a.kind === "asset" && a.is_active),
    [accounts]
  )
  const liabilityAccounts = useMemo(
    () => accounts.filter((a) => a.kind === "liability" && a.is_active),
    [accounts]
  )

  const form = useForm<BillFormValues>({
    resolver: zodResolver(billFormSchema),
    defaultValues: bill
      ? {
          name: bill.name,
          business_id: bill.business_id,
          default_account_id: bill.default_account_id,
          transaction_type: bill.transaction_type,
          pays_down_account_id: bill.pays_down_account_id,
          default_amount: bill.default_amount != null ? Number(bill.default_amount) : null,
          category_id: null,
          frequency_unit: bill.frequency_unit,
          frequency_interval: bill.frequency_interval,
          anchor_date: bill.anchor_date,
          is_active: bill.is_active,
          notes: bill.notes,
        }
      : {
          name: "",
          business_id: null,
          default_account_id: "",
          transaction_type: "expense",
          pays_down_account_id: null,
          default_amount: null,
          category_id: null,
          frequency_unit: "month",
          frequency_interval: 1,
          anchor_date: todayStr(),
          is_active: true,
          notes: null,
        },
  })

  const transactionType = form.watch("transaction_type")
  const defaultAccountId = form.watch("default_account_id")
  const isSubmitting = form.formState.isSubmitting

  useEffect(() => {
    if (transactionType === "expense") {
      form.setValue("pays_down_account_id", null, { shouldValidate: false })
    }
  }, [transactionType, form])

  useEffect(() => {
    if (amountMode === "variable") {
      form.setValue("default_amount", null, { shouldValidate: false })
    }
  }, [amountMode, form])

  const paysDownOptions = useMemo(
    () => liabilityAccounts.filter((a) => a.id !== defaultAccountId),
    [liabilityAccounts, defaultAccountId]
  )

  async function onSubmit(values: BillFormValues) {
    if (amountMode === "fixed" && (values.default_amount == null || values.default_amount <= 0)) {
      form.setError("default_amount", { message: "Amount is required for fixed bills" })
      return
    }
    const payload: BillFormValues = {
      ...values,
      default_amount: amountMode === "variable" ? null : values.default_amount,
      pays_down_account_id: values.transaction_type === "transfer" ? values.pays_down_account_id : null,
      category_id: null,
    }
    if (bill) {
      updateBill.mutate({ id: bill.id, values: payload }, { onSuccess })
    } else {
      createBill.mutate(payload, { onSuccess })
    }
  }

  function handleDelete() {
    if (!bill) return
    deleteBill.mutate(bill.id, { onSuccess })
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4 pb-6 space-y-5">

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Electric Bill" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Business */}
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
                      <SelectItem value="__personal__">Personal</SelectItem>
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

            {/* Type */}
            <FormField
              control={form.control}
              name="transaction_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <div className="flex rounded-lg border border-border overflow-hidden">
                      {(["expense", "transfer"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => field.onChange(t)}
                          className={cn(
                            "flex-1 py-2 text-sm font-medium transition-colors",
                            field.value === t
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-muted-foreground hover:bg-muted/50"
                          )}
                        >
                          {t === "expense" ? "Expense" : "Transfer"}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* From account */}
            <FormField
              control={form.control}
              name="default_account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From account *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {assetAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pays down (Transfer only) */}
            {transactionType === "transfer" && (
              <FormField
                control={form.control}
                name="pays_down_account_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pays down *</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v || null)}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select an account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paysDownOptions.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Credit card or other liability this bill pays down.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Amount mode */}
            <div>
              <p className="text-sm font-medium leading-none mb-2">Amount</p>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(["fixed", "variable"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAmountMode(m)}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium transition-colors",
                      amountMode === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {m === "fixed" ? "Fixed" : "Variable"}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input (Fixed only) */}
            {amountMode === "fixed" && (
              <FormField
                control={form.control}
                name="default_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={field.value != null && field.value > 0 ? field.value : ""}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value)
                            field.onChange(isNaN(v) ? null : v)
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Variable help text */}
            {amountMode === "variable" && (
              <p className="text-xs text-muted-foreground -mt-2">
                You&apos;ll enter the amount each time you mark it paid.
              </p>
            )}

            {/* Repeats every */}
            <div>
              <p className="text-sm font-medium leading-none mb-2">Repeats every</p>
              <div className="flex gap-2">
                <FormField
                  control={form.control}
                  name="frequency_interval"
                  render={({ field }) => (
                    <FormItem className="w-20">
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          value={field.value}
                          onChange={(e) => {
                            const v = parseInt(e.target.value)
                            field.onChange(isNaN(v) ? 1 : v)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="frequency_unit"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="week">Week</SelectItem>
                          <SelectItem value="month">Month</SelectItem>
                          <SelectItem value="year">Year</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Starting (anchor_date) */}
            <FormField
              control={form.control}
              name="anchor_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Starting *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormDescription>
                    First occurrence — future periods are calculated from this date.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional"
                      rows={2}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Active toggle (edit mode only) */}
            {bill && (
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="mb-0">Active</FormLabel>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={field.value}
                        onClick={() => field.onChange(!field.value)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          field.value ? "bg-primary" : "bg-muted"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                            field.value ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                    </div>
                    {!field.value && (
                      <FormDescription>
                        Paused bills don&apos;t appear in the upcoming list or contribute to monthly totals.
                      </FormDescription>
                    )}
                  </FormItem>
                )}
              />
            )}
          </div>

          {/* Sticky footer */}
          <div
            className="flex gap-3 border-t border-border bg-popover px-4 py-4 shrink-0"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            {bill && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-11 px-3"
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-11">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1 h-11">
              {isSubmitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Form>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bill?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the bill, all payment history, and any linked transactions.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={cn(buttonVariants({ variant: "destructive", size: "lg" }), "h-11")}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
