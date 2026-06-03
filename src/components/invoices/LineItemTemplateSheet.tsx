"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUpdateLineItemTemplate } from "@/lib/hooks/useLineItemTemplates"
import { BUSINESSES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { LineItemTemplate } from "@/lib/queries/lineItemTemplates"

const UNIT_LABELS: Record<string, string> = { hourly: "Hours", quantity: "Qty", flat: "Flat" }

interface Props {
  open: boolean
  onClose: () => void
  template: LineItemTemplate | undefined
  allTemplates: LineItemTemplate[]
}

export function LineItemTemplateSheet({ open, onClose, template, allTemplates }: Props) {
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState(0)
  const [unitType, setUnitType] = useState<"hourly" | "quantity" | "flat">("quantity")
  const [scope, setScope] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const updateTemplate = useUpdateLineItemTemplate()

  useEffect(() => {
    if (template) {
      setDescription(template.description)
      setPrice(template.default_unit_price)
      setUnitType(template.unit_type)
      setScope(template.business_id)
      setError(null)
    }
  }, [template?.id])

  function handleSave() {
    if (!template) return
    const trimmed = description.trim()
    if (!trimmed) {
      setError("Description is required")
      return
    }
    const dup = allTemplates.some(
      (t) =>
        t.id !== template.id &&
        t.description.toLowerCase() === trimmed.toLowerCase() &&
        t.business_id === scope
    )
    if (dup) {
      setError("A template with this name already exists for the selected scope")
      return
    }
    updateTemplate.mutate(
      {
        id: template.id,
        values: {
          description: trimmed,
          default_unit_price: price,
          unit_type: unitType,
          business_id: scope,
        },
      },
      { onSuccess: onClose }
    )
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>Edit Template</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => { setDescription(e.target.value); setError(null) }}
              placeholder="e.g. Photography — Full Day"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Unit type</Label>
            <div className="flex gap-1">
              {(["hourly", "quantity", "flat"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setUnitType(type)}
                  className={cn(
                    "flex-1 h-9 rounded text-sm font-medium transition-colors border",
                    unitType === type
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {UNIT_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Default price</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={price === 0 ? "" : price}
                onChange={(e) =>
                  setPrice(e.target.value === "" ? 0 : parseFloat(e.target.value))
                }
                className="tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select
              value={scope ?? "__global__"}
              onValueChange={(v) => { setScope(v === "__global__" ? null : v); setError(null) }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">All businesses</SelectItem>
                {BUSINESSES.map((biz) => (
                  <SelectItem key={biz.id} value={biz.id}>
                    {biz.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div
          className="shrink-0 border-t border-border px-4 py-4 flex gap-3"
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-11"
            onClick={onClose}
            disabled={updateTemplate.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="flex-1 h-11"
            onClick={handleSave}
            disabled={updateTemplate.isPending}
          >
            {updateTemplate.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
