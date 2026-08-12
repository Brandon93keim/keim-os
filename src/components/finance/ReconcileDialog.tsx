"use client"

import { format } from "date-fns"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { reconcileFormSchema, type ReconcileFormValues } from "@/lib/finance/schemas"
import { reconciliationDelta } from "@/lib/finance/reconciliation"
import { formatCurrency } from "@/lib/finance/format"
import { useReconcileAccount } from "@/lib/hooks/useTransactions"
import type { AccountWithBalance } from "@/lib/finance/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
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

interface Props {
  open: boolean
  onClose: () => void
  account: AccountWithBalance
}

function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd")
}

export function ReconcileDialog({ open, onClose, account }: Props) {
  const reconcile = useReconcileAccount()
  const currentBalance = Number(account.current_balance)

  const defaultValues: ReconcileFormValues = {
    statement_balance: null,
    occurred_on: todayStr(),
  }

  const form = useForm<ReconcileFormValues>({
    resolver: zodResolver(reconcileFormSchema),
    defaultValues,
  })

  const statementBalance = form.watch("statement_balance")
  const isSubmitting = form.formState.isSubmitting

  // Same computation the write path runs, so the preview can't disagree with
  // what actually gets recorded.
  const delta =
    statementBalance === null ? null : reconciliationDelta(currentBalance, statementBalance)

  function handleOpenChange(o: boolean) {
    if (!o) {
      form.reset(defaultValues)
      onClose()
    }
  }

  async function onSubmit(values: ReconcileFormValues) {
    if (values.statement_balance === null) return
    reconcile.mutate(
      {
        account: { id: account.id, name: account.name, current_balance: currentBalance },
        statement_balance: values.statement_balance,
        occurred_on: values.occurred_on,
      },
      { onSuccess: () => handleOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reconcile — {account.name}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2">
          Recorded balance:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatCurrency(Math.abs(currentBalance))}
          </span>{" "}
          owed
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Statement balance */}
            <FormField
              control={form.control}
              name="statement_balance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statement balance *</FormLabel>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">$</span>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                          field.onChange(isNaN(v) ? null : v)
                        }}
                      />
                    </FormControl>
                  </div>
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
                  <FormLabel>As of *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* What will be written */}
            {statementBalance !== null && (
              <div className="rounded-lg bg-muted/60 px-3 py-3 text-sm">
                {delta === null ? (
                  <p className="text-muted-foreground">
                    Already matches the statement — nothing will be recorded.
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Records a{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(delta.amount)}
                    </span>{" "}
                    {delta.type === "expense" ? "expense" : "credit"} on {account.name}
                    {delta.type === "expense"
                      ? " for charges that were never entered."
                      : " for a refund or overpayment."}{" "}
                    It stays out of P&L.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1 h-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || reconcile.isPending}
                className="flex-1 h-11"
              >
                {reconcile.isPending ? "Saving…" : "Reconcile"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
