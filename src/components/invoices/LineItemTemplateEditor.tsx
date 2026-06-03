"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import {
  useAllLineItemTemplates,
  useDeleteLineItemTemplate,
} from "@/lib/hooks/useLineItemTemplates"
import { getBusinessById } from "@/lib/constants"
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
import { PageHeader } from "@/components/layout/PageHeader"
import { LineItemTemplateSheet } from "./LineItemTemplateSheet"
import type { LineItemTemplate } from "@/lib/queries/lineItemTemplates"

const UNIT_LABEL: Record<string, string> = { hourly: "Hours", quantity: "Qty", flat: "Flat" }

function TemplateSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-5 w-12 rounded-full" />
    </div>
  )
}

function SectionHeader({ title, color }: { title: string; color?: string }) {
  return (
    <div className="px-4 pb-2 flex items-center gap-2">
      {color && (
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
    </div>
  )
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: LineItemTemplate
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={onEdit}
        className="flex flex-1 items-center gap-3 px-4 py-3.5 min-w-0 text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{template.description}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            ${template.default_unit_price.toFixed(2)}
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground shrink-0">
          {UNIT_LABEL[template.unit_type]}
        </span>
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${template.description}`}
        className="flex h-12 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-destructive transition-colors pr-2"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

export function LineItemTemplateEditor() {
  const { data: templates = [], isLoading } = useAllLineItemTemplates()
  const deleteTemplate = useDeleteLineItemTemplate()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<LineItemTemplate | undefined>(undefined)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const globals = templates.filter((t) => t.business_id === null)
  const businessIds = [
    ...new Set(
      templates.filter((t) => t.business_id !== null).map((t) => t.business_id!)
    ),
  ]

  function openEdit(template: LineItemTemplate) {
    setEditing(template)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditing(undefined)
  }

  function executeDelete() {
    if (confirmDeleteId) {
      deleteTemplate.mutate(confirmDeleteId)
      setConfirmDeleteId(null)
    }
  }

  const isEmpty = !isLoading && templates.length === 0

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader title="Line Item Templates" backHref="/invoices" />

      <div className="flex-1 pb-6">
        {isLoading ? (
          <div className="mt-4 divide-y divide-border border-y border-border">
            <TemplateSkeleton />
            <TemplateSkeleton />
            <TemplateSkeleton />
          </div>
        ) : isEmpty ? (
          <div className="mt-10 flex flex-col items-center gap-3 px-6 text-center">
            <p className="text-sm text-muted-foreground">
              No templates yet. Save a line item as a template from the invoice form.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {globals.length > 0 && (
              <div>
                <SectionHeader title="Global" />
                <div className="divide-y divide-border border-y border-border">
                  {globals.map((t) => (
                    <TemplateRow
                      key={t.id}
                      template={t}
                      onEdit={() => openEdit(t)}
                      onDelete={() => setConfirmDeleteId(t.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {businessIds.map((bizId) => {
              const biz = getBusinessById(bizId)
              const bizTemplates = templates.filter((t) => t.business_id === bizId)
              return (
                <div key={bizId}>
                  <SectionHeader title={biz?.name ?? bizId} color={biz?.color} />
                  <div className="divide-y divide-border border-y border-border">
                    {bizTemplates.map((t) => (
                      <TemplateRow
                        key={t.id}
                        template={t}
                        onEdit={() => openEdit(t)}
                        onDelete={() => setConfirmDeleteId(t.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <LineItemTemplateSheet
        open={sheetOpen}
        onClose={closeSheet}
        template={editing}
        allTemplates={templates}
      />

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => { if (!o) setConfirmDeleteId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This template will be removed. Line items already on invoices are unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={executeDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
