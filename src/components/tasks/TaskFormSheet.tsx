"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { TaskForm } from "./TaskForm"
import type { TaskWithRelations } from "@/lib/hooks/useTasks"

interface Props {
  open: boolean
  onClose: () => void
  task?: TaskWithRelations | null
}

export function TaskFormSheet({ open, onClose, task }: Props) {
  const title = task ? "Edit Task" : "New Task"

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[95dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <TaskForm task={task} onSuccess={onClose} onCancel={onClose} />
      </SheetContent>
    </Sheet>
  )
}
