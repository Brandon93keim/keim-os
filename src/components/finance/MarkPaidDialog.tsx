"use client"

import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { billPaymentFormSchema, type BillPaymentFormValues } from "@/lib/finance/schemas"
import { useRecordBillPayment } from "@/lib/hooks/useBills"
import { useAllAccounts } from "@/lib/hooks/useAccounts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RecordBillPaymentContext } from "@/lib/queries/bills"

interface Props {
  open: boolean
  onClose: () => void
  ctx: RecordBillPaymentContext
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]
}

export function MarkPaidDialog({ open, onClose, ctx }: Props) {
  const { data: accounts = [] } = useAllAccounts()

  const assetAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.kind === "asset" &&
          a.is_active &&
          (ctx.transactionType !== "transfer" || a.id !== ctx.paysDownAccountId)
      ),
    [accounts, ctx.transactionType, ctx.paysDownAccountId]
  )

  const paysDownAccount = useMemo(
    () => (ctx.paysDownAccountId ? accounts.find((a) => a.id === ctx.paysDownAccountId) : null),
    [accounts, ctx.paysDownAccountId]
  )

  const recordBillPayment = useRecordBillPayment(ctx)

  const defaultValues: BillPaymentFormValues = {
    bill_id: ctx.billId,
    amount: ctx.defaultAmount ?? (0 as unknown as number),
    paid_on: todayStr(),
    period_start: ctx.nextDueDate ?? todayStr(),
    account_id: ctx.defaultAccountId,
    notes: null,
  }

  const form = useForm<BillPaymentFormValues>({
    resolver: zodResolver(billPaymentFormSchema),
    defaultValues,
  })

  const isSubmitting = form.formState.isSubmitting

  function handleOpenChange(o: boolean) {
    if (!o) {
      form.reset(defaultValues)
      onClose()
    }
  }

  async function onSubmit(values: BillPaymentFormValues) {
    recordBillPayment.mutate(values, { onSuccess: () => handleOpenChange(false) })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark Paid — {ctx.billName}</DialogTitle>
        </DialogHeader>

        {ctx.transactionType === "transfer" && paysDownAccount && (
          <p className="text-sm text-muted-foreground -mt-2">
            Pays down:{" "}
            <span className="font-medium text-foreground">{paysDownAccount.name}</span>
          </p>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount *</FormLabel>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">$</span>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0.01}
                        step={0.01}
                        placeholder="0.00"
                        value={field.value > 0 ? field.value : ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? 0 : parseFloat(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Paid on */}
            <FormField
              control={form.control}
              name="paid_on"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid on *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Period covered */}
            <FormField
              control={form.control}
              name="period_start"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period covered *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* From account */}
            <FormField
              control={form.control}
              name="account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From account *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
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

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1 h-11"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1 h-11">
                {isSubmitting ? "Saving…" : "Record"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
