"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ClientForm } from "./ClientForm"
import type { Client } from "@/lib/queries/clients"

interface Props {
  open: boolean
  onClose: () => void
  client?: Client
}

export function ClientFormSheet({ open, onClose, client }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>{client ? "Edit Client" : "New Client"}</SheetTitle>
        </SheetHeader>
        <ClientForm client={client} onSuccess={onClose} onCancel={onClose} />
      </SheetContent>
    </Sheet>
  )
}
