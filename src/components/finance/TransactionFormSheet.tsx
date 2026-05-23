"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { TransactionForm } from "./TransactionForm"
import type { TransactionWithRelations } from "@/lib/finance/types"

interface Props {
  open: boolean
  onClose: () => void
  transaction?: TransactionWithRelations
}

export function TransactionFormSheet({ open, onClose, transaction }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>{transaction ? "Edit Transaction" : "New Transaction"}</SheetTitle>
        </SheetHeader>
        <TransactionForm transaction={transaction} onSuccess={onClose} onCancel={onClose} />
      </SheetContent>
    </Sheet>
  )
}
