"use client"

import { useState } from "react"
import { Bookmark } from "lucide-react"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCreateLineItemTemplate } from "@/lib/hooks/useLineItemTemplates"
import type { LineItemTemplate } from "@/lib/queries/lineItemTemplates"
import { getBusinessById } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface Job {
  id: string
  title: string
  job_total_amount: number | null
  start_time: string
}

interface Props {
  open: boolean
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  /** null while closed — no line item is being edited. */
  index: number | null
  availableJobs: Job[]
  templates: LineItemTemplate[]
  watchedBusinessId: string | null
  /** Undefined when this is the last remaining line item. */
  onRemove?: () => void
  canRemove: boolean
}

const UNIT_TYPE_LABELS: Record<'hourly' | 'quantity' | 'flat', string> = {
  hourly: 'Hours',
  quantity: 'Qty',
  flat: 'Flat',
}

export function LineItemEditSheet({ open, onClose, index, ...rest }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>Edit line item</SheetTitle>
        </SheetHeader>
        {index !== null && (
          <LineItemEditSheetBody index={index} onClose={onClose} {...rest} />
        )}
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Body — split out so every form read below can assume a non-null index, and so
// its state resets between items (it unmounts with the sheet).
// ---------------------------------------------------------------------------
type BodyProps = Omit<Props, "open" | "index"> & { index: number }

function LineItemEditSheetBody({
  onClose,
  form,
  index,
  availableJobs,
  templates,
  watchedBusinessId,
  onRemove,
  canRemove,
}: BodyProps) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [templateScope, setTemplateScope] = useState<string | null>(watchedBusinessId)
  const createTemplate = useCreateLineItemTemplate()

  const description = (form.watch(`line_items.${index}.description`) as string) || ""
  const unitType = (form.watch(`line_items.${index}.unit_type`) || 'quantity') as 'hourly' | 'quantity' | 'flat'
  const qty = form.watch(`line_items.${index}.quantity`) || 0
  const price = form.watch(`line_items.${index}.unit_price`) || 0
  const rowTotal = Math.round(qty * price * 100) / 100

  const filteredTemplates = templates.filter((t) =>
    description === "" || t.description.toLowerCase().includes(description.toLowerCase())
  )

  function handleTemplateSelect(t: LineItemTemplate) {
    form.setValue(`line_items.${index}.description`, t.description, { shouldValidate: true })
    form.setValue(`line_items.${index}.unit_price`, t.default_unit_price)
    const newType = t.unit_type ?? 'quantity'
    form.setValue(`line_items.${index}.unit_type`, newType)
    if (newType === 'flat') {
      form.setValue(`line_items.${index}.quantity`, 1)
    }
    setSuggestionsOpen(false)
  }

  function handleUnitTypeChange(newType: 'hourly' | 'quantity' | 'flat') {
    const prevType = form.getValues(`line_items.${index}.unit_type`) as string
    form.setValue(`line_items.${index}.unit_type`, newType)
    if (newType === 'flat') {
      form.setValue(`line_items.${index}.quantity`, 1)
    } else if (prevType === 'flat') {
      form.setValue(`line_items.${index}.quantity`, 1)
    }
  }

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

  function handleSaveTemplate() {
    const normalizedDesc = description.trim().toLowerCase()
    const duplicate = templates.some(
      (t) => t.description.toLowerCase() === normalizedDesc && t.business_id === templateScope
    )
    if (duplicate) {
      toast("Template already exists")
      setSaveTemplateOpen(false)
      return
    }
    createTemplate.mutate(
      {
        description: description.trim(),
        default_unit_price: price,
        unit_type: unitType,
        business_id: templateScope,
      },
      { onSuccess: () => setSaveTemplateOpen(false) }
    )
  }

  const currentEventId = form.watch(`line_items.${index}.event_id`)

  const { onBlur: regBlur, ...descReg } = form.register(`line_items.${index}.description`)

  const qtyConfig = unitType === 'hourly'
    ? { label: 'Hours', step: 0.25, min: 0.25, placeholder: '0.25' }
    : { label: 'Qty', step: 1, min: 1, placeholder: '1' }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Description with typeahead */}
        <div className="space-y-1.5">
          <Label>Description *</Label>
          <div className="flex items-start gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Description *"
                {...descReg}
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={(e) => {
                  regBlur(e)
                  setTimeout(() => setSuggestionsOpen(false), 150)
                }}
                className={cn(
                  "w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  form.formState.errors.line_items?.[index]?.description && "border-destructive"
                )}
              />
              {suggestionsOpen && filteredTemplates.length > 0 && (
                <ul className="absolute z-50 top-full mt-1 left-0 right-0 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {filteredTemplates.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleTemplateSelect(t)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between gap-2"
                      >
                        <span>{t.description}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ${t.default_unit_price.toFixed(2)} · {t.unit_type === 'hourly' ? 'hrs' : t.unit_type === 'flat' ? 'flat' : 'qty'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Popover
              open={saveTemplateOpen}
              onOpenChange={(open) => {
                if (open) setTemplateScope(watchedBusinessId)
                setSaveTemplateOpen(open)
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={!description.trim()}
                  title="Save as template"
                  className="shrink-0 h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Bookmark size={14} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-3" align="end">
                <p className="text-xs text-muted-foreground">
                  Save{" "}
                  <span className="font-medium text-foreground">&ldquo;{description}&rdquo;</span>{" "}
                  as a template for:
                </p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setTemplateScope(watchedBusinessId)}
                    className={cn(
                      "flex-1 h-7 rounded text-xs font-medium transition-colors border truncate px-2",
                      templateScope !== null
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {getBusinessById(watchedBusinessId ?? "")?.name ?? "This business"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateScope(null)}
                    className={cn(
                      "flex-1 h-7 rounded text-xs font-medium transition-colors border",
                      templateScope === null
                        ? "bg-foreground text-background border-foreground"
                        : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    All businesses
                  </button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={handleSaveTemplate}
                  disabled={createTemplate.isPending}
                >
                  Save
                </Button>
              </PopoverContent>
            </Popover>
          </div>
          {form.formState.errors.line_items?.[index]?.description && (
            <p className="text-xs text-destructive">
              {form.formState.errors.line_items[index].description.message}
            </p>
          )}
        </div>

        {/* Unit type toggle */}
        <div className="space-y-1.5">
          <Label>Unit type</Label>
          <div className="flex gap-1">
            {(Object.keys(UNIT_TYPE_LABELS) as Array<'hourly' | 'quantity' | 'flat'>).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleUnitTypeChange(type)}
                className={cn(
                  "flex-1 h-9 rounded text-sm font-medium transition-colors border",
                  unitType === type
                    ? "bg-foreground text-background border-foreground"
                    : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {UNIT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Linked job (if jobs available) */}
        {availableJobs.length > 0 && (
          <div className="space-y-1.5">
            <Label>Linked job</Label>
            <Select
              value={currentEventId ?? "__none__"}
              onValueChange={handleJobSelect}
            >
              <SelectTrigger className="w-full">
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
          </div>
        )}

        {/* Qty | Price | Amount */}
        <div className="flex items-center gap-2">
          {unitType !== 'flat' && (
            <div className="w-20">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {qtyConfig.label}
              </Label>
              <input
                type="number"
                inputMode="decimal"
                min={qtyConfig.min}
                step={qtyConfig.step}
                placeholder={qtyConfig.placeholder}
                {...form.register(`line_items.${index}.quantity`, { valueAsNumber: true })}
                className="mt-0.5 w-full h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring tabular-nums"
              />
            </div>
          )}
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
          <div className="w-24 text-right">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</Label>
            <div className="mt-0.5 h-9 flex items-center justify-end text-sm font-semibold tabular-nums text-foreground">
              ${rowTotal.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div
        className="shrink-0 border-t border-border px-4 py-4 flex gap-3"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        {canRemove && (
          <Button
            type="button"
            variant="destructive"
            className="flex-1 h-11"
            onClick={() => {
              onRemove?.()
              onClose()
            }}
          >
            Remove item
          </Button>
        )}
        <Button type="button" className="flex-1 h-11" onClick={onClose}>
          Done
        </Button>
      </div>
    </>
  )
}
