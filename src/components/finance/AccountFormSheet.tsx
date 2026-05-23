"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AccountForm } from "./AccountForm"
import type { AccountWithBalance } from "@/lib/finance/types"

interface Props {
  open: boolean
  onClose: () => void
  account?: AccountWithBalance
}

export function AccountFormSheet({ open, onClose, account }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>{account ? "Edit Account" : "New Account"}</SheetTitle>
        </SheetHeader>
        <AccountForm account={account} onSuccess={onClose} onCancel={onClose} />
      </SheetContent>
    </Sheet>
  )
}
