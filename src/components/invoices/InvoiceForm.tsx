"use client"

import { useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { addDays, format } from "date-fns"
import { Download, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import {
  invoiceFormSchema,
  type InvoiceFormValues,
  type InvoiceFormInput,
  type LineItemFormInput,
  DEFAULT_TERMS,
  PAYMENT_METHOD_LABELS,
  DUE_TERM_LABELS,
} from "@/lib/validations/invoice"
import { BUSINESSES, getBusinessById } from "@/lib/constants"
import { BUSINESS_IDS } from "@/lib/validations/client"
import { useCreateInvoice, useUpdateInvoice, useMarkInvoiceSent, useJobsForLineItem } from "@/lib/hooks/useInvoices"
import { useClients } from "@/lib/hooks/useClients"
import { useProfile } from "@/lib/hooks/useProfile"
import { getInvoice } from "@/lib/queries/invoices"
import { downloadInvoicePdf } from "@/lib/pdf"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
import type { Invoice } from "@/lib/queries/invoices"
import type { UnbilledJob } from "@/lib/queries/jobs"

interface Props {
  invoice?: Invoice | null
  prefillJob?: UnbilledJob | null
  onSuccess: (invoiceId: string) => void
  onCancel: () => void
}

function buildDefaults(invoice?: Invoice | null, prefillJob?: UnbilledJob | null): InvoiceFormInput {
  if (invoice) {
    return {
      business_id: invoice.business_id as (typeof BUSINESS_IDS)[number],
      client_id: invoice.client_id,
      issue_date: new Date(invoice.issue_date),
      due_date: new Date(invoice.due_date),
      due_terms: invoice.due_terms ?? 'custom',
      tax_rate: invoice.tax_rate,
      discount_amount: invoice.discount_amount,
      notes: invoice.notes ?? "",
      terms: invoice.terms ?? "",
      email_address: invoice.email_address ?? "",
      line_items: invoice.line_items.map((li): LineItemFormInput => ({
        id: li.id,
        event_id: li.event_id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
      })),
    }
  }

  const today = new Date()

  if (prefillJob) {
    const lineItems = prefillJob.unbilled_events.length > 0
      ? prefillJob.unbilled_events.map((ev) => ({
          id: undefined,
          event_id: ev.event_id,
          description: ev.title,
          quantity: 1,
          unit_price: 0,
        }))
      : [{ id: undefined, event_id: null, description: "", quantity: 1, unit_price: 0 }]
    return {
      business_id: prefillJob.business_id as (typeof BUSINESS_IDS)[number],
      client_id: prefillJob.client_id ?? "",
      issue_date: today,
      due_date: addDays(today, 30),
      due_terms: 'net_30' as const,
      tax_rate: 0,
      discount_amount: 0,
      notes: "",
      terms: DEFAULT_TERMS,
      email_address: "",
      line_items: lineItems,
    }
  }

  return {
    business_id: BUSINESSES[0].id as (typeof BUSINESS_IDS)[number],
    client_id: "",
    issue_date: today,
    due_date: addDays(today, 30),
    due_terms: 'net_30' as const,
    tax_rate: 0,
    discount_amount: 0,
    notes: "",
    terms: DEFAULT_TERMS,
    email_address: "",
    line_items: [{ id: undefined, event_id: null, description: "", quantity: 1, unit_price: 0 }],
  }
}

export function InvoiceForm({ invoice, prefillJob, onSuccess, onCancel }: Props) {
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const markSentMutation = useMarkInvoiceSent()
  const { data: clients = [] } = useClients()
  const { data: profile } = useProfile()

  const form = useForm<InvoiceFormInput>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: buildDefaults(invoice, prefillJob),
    shouldFocusError: false,
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "line_items",
  })

  const watchedBusinessId = form.watch("business_id")
  const watchedClientId = form.watch("client_id")
  const watchedIssueDate = form.watch("issue_date")
  const watchedDueTerms = form.watch("due_terms")
  const watchedDueDate = form.watch("due_date")
  const watchedLineItems = form.watch("line_items")
  const watchedTaxRate = form.watch("tax_rate")
  const watchedDiscount = form.watch("discount_amount")

  const { data: availableJobs = [] } = useJobsForLineItem(
    watchedClientId || null,
    watchedBusinessId || null
  )

  const selectedClient = clients.find((c) => c.id === watchedClientId)

  // Auto-fill email when client is selected (only if field is empty)
  useEffect(() => {
    if (selectedClient?.email && !form.getValues("email_address")) {
      form.setValue("email_address", selectedClient.email)
    }
  }, [selectedClient?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recompute due_date whenever issue_date or due_terms changes (for non-custom terms)
  useEffect(() => {
    if (watchedDueTerms === 'on_receipt') {
      form.setValue("due_date", watchedIssueDate)
    } else if (watchedDueTerms === 'net_15') {
      form.setValue("due_date", addDays(watchedIssueDate, 15))
    } else if (watchedDueTerms === 'net_30') {
      form.setValue("due_date", addDays(watchedIssueDate, 30))
    }
    // custom: do not recompute
  }, [watchedIssueDate, watchedDueTerms]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live totals
  const subtotal = watchedLineItems.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
    0
  )
  const taxAmount = Math.round(subtotal * (watchedTaxRate || 0) / 100 * 100) / 100
  const total = subtotal + taxAmount - (watchedDiscount || 0)

  const isSubmitting = form.formState.isSubmitting

  async function submit(values: InvoiceFormInput) {
    const v = values as unknown as InvoiceFormValues
    if (invoice) {
      updateInvoice.mutate(
        { id: invoice.id, values: v },
        { onSuccess: () => onSuccess(invoice.id) }
      )
    } else {
      createInvoice.mutate(v, {
        onSuccess: (data) => onSuccess(data.id),
      })
    }
  }

  async function submitAndDownload(values: InvoiceFormInput) {
    const v = values as unknown as InvoiceFormValues
    let savedId: string
    try {
      if (invoice) {
        await updateInvoice.mutateAsync({ id: invoice.id, values: v })
        savedId = invoice.id
      } else {
        const data = await createInvoice.mutateAsync(v)
        savedId = data.id
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save invoice")
      return
    }

    const shouldMarkSent = !invoice || invoice.status === "draft"
    if (shouldMarkSent) {
      try {
        await markSentMutation.mutateAsync(savedId)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to mark invoice as sent")
        onSuccess(savedId)
        return
      }
    }

    try {
      const freshInvoice = await getInvoice(savedId)
      const biz = getBusinessById(freshInvoice.business_id)
      if (!biz || !profile) throw new Error("Missing business or profile data")
      await downloadInvoicePdf(
        freshInvoice,
        freshInvoice.line_items,
        freshInvoice.payments,
        freshInvoice.client ?? null,
        biz,
        profile,
      )
    } catch {
      toast.error("Saved, but PDF generation failed. Open the invoice to download.")
    }

    onSuccess(savedId)
  }

  return (
    <Form {...form}>
      <form className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4 pb-6 space-y-5">

          {/* Business */}
          <FormField
            control={form.control}
            name="business_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business *</FormLabel>
                <div className="flex flex-wrap gap-2">
                  {BUSINESSES.map((biz) => {
                    const selected = field.value === biz.id
                    return (
                      <button
                        key={biz.id}
                        type="button"
                        onClick={() => field.onChange(biz.id)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px]",
                          selected ? "border-transparent" : "border-border bg-transparent text-muted-foreground hover:text-foreground"
                        )}
                        style={selected ? { backgroundColor: biz.color, color: "#fff" } : {}}
                      >
                        {biz.name}
                      </button>
                    )
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Client */}
          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client *</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                  value={field.value || "__none__"}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select client…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Select client…</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.company ? ` — ${c.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Issue Date */}
          <FormField
            control={form.control}
            name="issue_date"
            render={({ field }) => (
              <DatePickerField
                label="Issue date *"
                value={field.value}
                onChange={field.onChange}
                error={form.formState.errors.issue_date?.message}
              />
            )}
          />

          {/* Payment Terms */}
          <FormField
            control={form.control}
            name="due_terms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment terms *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(Object.keys(DUE_TERM_LABELS) as Array<keyof typeof DUE_TERM_LABELS>).map((key) => (
                      <SelectItem key={key} value={key}>{DUE_TERM_LABELS[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Due Date — picker for custom, read-only computed for fixed terms */}
          {watchedDueTerms !== 'on_receipt' && (
            watchedDueTerms === 'custom' ? (
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <DatePickerField
                    label="Due date *"
                    value={field.value}
                    onChange={field.onChange}
                    minDate={watchedIssueDate}
                    error={form.formState.errors.due_date?.message}
                  />
                )}
              />
            ) : (
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <div className="h-10 flex items-center text-sm px-3 rounded-md border border-input bg-muted/30 text-muted-foreground">
                  {watchedDueDate ? format(watchedDueDate, "MMM d, yyyy") : "—"}
                </div>
              </div>
            )
          )}

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Line Items *</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                Subtotal: ${subtotal.toFixed(2)}
              </span>
            </div>

            <div className="space-y-3">
              {fields.map((fieldItem, index) => (
                <LineItemRow
                  key={fieldItem.id}
                  index={index}
                  form={form}
                  availableJobs={availableJobs}
                  onRemove={fields.length > 1 ? () => remove(index) : undefined}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => append({ id: undefined, event_id: null, description: "", quantity: 1, unit_price: 0 })}
              className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              <Plus size={14} />
              Add line item
            </button>
            {form.formState.errors.line_items?.root?.message && (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.line_items.root.message}
              </p>
            )}
          </div>

          {/* Tax & discount */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="tax_rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax rate</FormLabel>
                  <div className="flex items-center gap-1.5">
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step={0.01}
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <span className="text-sm text-muted-foreground shrink-0">%</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="discount_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discount</FormLabel>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground shrink-0">$</span>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.01}
                        placeholder="0.00"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Live total preview */}
          <div className="rounded-xl bg-muted/50 border border-border px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">${subtotal.toFixed(2)}</span>
            </div>
            {(watchedTaxRate ?? 0) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tax ({watchedTaxRate}%)</span>
                <span className="tabular-nums">${taxAmount.toFixed(2)}</span>
              </div>
            )}
            {(watchedDiscount ?? 0) > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="tabular-nums">-${(watchedDiscount ?? 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between font-bold border-t border-border pt-1.5">
              <span>Total</span>
              <span className="tabular-nums">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Send-to email */}
          <FormField
            control={form.control}
            name="email_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Send to email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    inputMode="email"
                    placeholder="client@example.com"
                    {...field}
                  />
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
                  <Textarea placeholder="Internal or client-facing notes…" rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Terms */}
          <FormField
            control={form.control}
            name="terms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Terms</FormLabel>
                <FormControl>
                  <Textarea placeholder="Payment terms…" rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Sticky footer */}
        <div
          className="shrink-0 border-t border-border bg-popover px-4 py-4"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-11">
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              className="flex-1 h-11"
              onClick={form.handleSubmit(submit)}
            >
              {isSubmitting ? "Saving…" : invoice ? "Save" : "Save Draft"}
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              className="flex-1 h-11 gap-1.5"
              onClick={form.handleSubmit(submitAndDownload)}
            >
              {isSubmitting ? (
                "Generating…"
              ) : (
                <>
                  <Download size={14} />
                  Save & Download PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}

// ---------------------------------------------------------------------------
// DatePickerField — extracted to keep InvoiceForm body readable
// ---------------------------------------------------------------------------
interface DatePickerFieldProps {
  label: string
  value: Date
  onChange: (d: Date) => void
  minDate?: Date
  error?: string
}

function DatePickerField({ label, value, onChange, error }: DatePickerFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start font-normal h-10 text-sm">
            {value ? format(value, "MMM d, yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => { if (d) onChange(d) }}
          />
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LineItemRow — one row in the line items array
// ---------------------------------------------------------------------------
interface Job {
  id: string
  title: string
  job_total_amount: number | null
  start_time: string
}

interface LineItemRowProps {
  index: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  availableJobs: Job[]
  onRemove?: () => void
}

function LineItemRow({ index, form, availableJobs, onRemove }: LineItemRowProps) {
  const qty = form.watch(`line_items.${index}.quantity`) || 0
  const price = form.watch(`line_items.${index}.unit_price`) || 0
  const rowTotal = Math.round(qty * price * 100) / 100

  function handleJobSelect(jobId: string) {
    if (jobId === "__none__") {
      form.setValue(`line_items.${index}.event_id`, null)
      return
    }
    const job = availableJobs.find((j) => j.id === jobId)
    if (!job) return
    form.setValue(`line_items.${index}.event_id`, job.id)
    if (!form.getValues(`line_items.${index}.description`)) {
      form.setValue(`line_items.${index}.description`, job.title)
    }
    if (!form.getValues(`line_items.${index}.unit_price`) && job.job_total_amount != null) {
      form.setValue(`line_items.${index}.unit_price`, job.job_total_amount)
    }
  }

  const currentEventId = form.watch(`line_items.${index}.event_id`)

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
      {/* Description row */}
      <div className="flex items-start gap-2">
        <input
          type="text"
          placeholder="Description *"
          {...form.register(`line_items.${index}.description`)}
          className={cn(
            "flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            form.formState.errors.line_items?.[index]?.description && "border-destructive"
          )}
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Linked job (if jobs available) */}
      {availableJobs.length > 0 && (
        <Select
          value={currentEventId ?? "__none__"}
          onValueChange={handleJobSelect}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Link to job (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No linked job</SelectItem>
            {availableJobs.map((job) => (
              <SelectItem key={job.id} value={job.id}>
                {job.title}
                {job.job_total_amount != null ? ` — $${job.job_total_amount.toFixed(2)}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Qty | Price | Total */}
      <div className="flex items-center gap-2">
        <div className="w-16">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Qty</Label>
          <input
            type="number"
            inputMode="decimal"
            min={0.01}
            step={0.01}
            placeholder="1"
            {...form.register(`line_items.${index}.quantity`, { valueAsNumber: true })}
            className="mt-0.5 w-full h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring tabular-nums"
          />
        </div>
        <div className="flex-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit price</Label>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="text-xs text-muted-foreground">$</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              placeholder="0.00"
              {...form.register(`line_items.${index}.unit_price`, { valueAsNumber: true })}
              className="flex-1 h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring tabular-nums"
            />
          </div>
        </div>
        <div className="w-20 text-right">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</Label>
          <div className="mt-0.5 h-9 flex items-center justify-end text-sm font-semibold tabular-nums text-foreground">
            ${rowTotal.toFixed(2)}
          </div>
        </div>
      </div>

      {form.formState.errors.line_items?.[index]?.description && (
        <p className="text-xs text-destructive">
          {form.formState.errors.line_items[index].description.message}
        </p>
      )}
    </div>
  )
}
