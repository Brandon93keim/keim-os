"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { EventForm } from "./EventForm"
import type { CalEvent } from "@/lib/hooks/useEvents"
import type { EventFormValues } from "@/lib/validations/event"
import type { RecurringScope } from "./RecurringEditDialog"

interface FormDefaults {
  start_time?: Date
  end_time?: Date
  type?: EventFormValues["type"]
}

interface Props {
  open: boolean
  onClose: () => void
  event?: CalEvent | null
  defaults?: FormDefaults
  recurringEditScope?: RecurringScope
  recurringMasterId?: string
  recurringOccurrenceDate?: Date
}

const SCOPE_TITLES: Record<RecurringScope, string> = {
  single: "Edit This Occurrence",
  following: "Edit This & Following",
  all: "Edit All Occurrences",
}

export function EventFormSheet({
  open,
  onClose,
  event,
  defaults,
  recurringEditScope,
  recurringMasterId,
  recurringOccurrenceDate,
}: Props) {
  const title = recurringEditScope
    ? SCOPE_TITLES[recurringEditScope]
    : event
      ? "Edit Event"
      : "New Event"

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[90dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <EventForm
          event={event}
          defaults={defaults}
          onSuccess={onClose}
          onCancel={onClose}
          recurringEditScope={recurringEditScope}
          recurringMasterId={recurringMasterId}
          recurringOccurrenceDate={recurringOccurrenceDate}
        />
      </SheetContent>
    </Sheet>
  )
}
