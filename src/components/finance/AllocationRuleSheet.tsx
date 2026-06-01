"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AllocationRuleForm } from "./AllocationRuleForm"
import type { AllocationRuleWithAccount } from "@/lib/finance/types"

interface Props {
  open: boolean
  onClose: () => void
  rule?: AllocationRuleWithAccount
  currentTotal: number
}

export function AllocationRuleSheet({ open, onClose, rule, currentTotal }: Props) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>{rule ? "Edit Rule" : "New Rule"}</SheetTitle>
        </SheetHeader>
        <AllocationRuleForm
          rule={rule}
          currentTotal={currentTotal}
          onSuccess={onClose}
          onCancel={onClose}
        />
      </SheetContent>
    </Sheet>
  )
}
