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
}

export function EventFormSheet({ open, onClose, event, defaults }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[90dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>{event ? "Edit Event" : "New Event"}</SheetTitle>
        </SheetHeader>
        <EventForm
          event={event}
          defaults={defaults}
          onSuccess={onClose}
          onCancel={onClose}
        />
      </SheetContent>
    </Sheet>
  )
}
