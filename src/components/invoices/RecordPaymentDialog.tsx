"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { paymentFormSchema, type PaymentFormValues, PAYMENT_METHOD_LABELS } from "@/lib/validations/invoice"
import { useRecordPayment } from "@/lib/hooks/useInvoices"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"

interface Props {
  open: boolean
  onClose: () => void
  invoiceId: string
  amountDue: number
}

export function RecordPaymentDialog({ open, onClose, invoiceId, amountDue }: Props) {
  const recordPayment = useRecordPayment(invoiceId)

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: amountDue > 0 ? amountDue : 0,
      payment_date: new Date(),
      method: "check",
      reference: "",
      notes: "",
    },
  })

  // Keep default amount in sync when dialog re-opens with a new amountDue
  const isSubmitting = form.formState.isSubmitting

  function handleOpenChange(o: boolean) {
    if (!o) {
      form.reset({
        amount: amountDue > 0 ? amountDue : 0,
        payment_date: new Date(),
        method: "check",
        reference: "",
        notes: "",
      })
      onClose()
    }
  }

  async function onSubmit(values: PaymentFormValues) {
    recordPayment.mutate(values, { onSuccess: () => handleOpenChange(false) })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

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
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                  </div>
                  {amountDue > 0 && (
                    <button
                      type="button"
                      onClick={() => form.setValue("amount", amountDue)}
                      className="text-xs text-primary underline"
                    >
                      Use full amount due (${amountDue.toFixed(2)})
                    </button>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment date */}
            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start font-normal">
                        {field.value ? format(field.value, "MMMM d, yyyy") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(d) => { if (d) field.onChange(d) }}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Method */}
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Method *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.entries(PAYMENT_METHOD_LABELS) as [string, string][]).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reference */}
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference / check #</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
                  </FormControl>
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
                    <Textarea placeholder="Optional" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} className="flex-1 h-11">
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
