"use client"

import { Check } from "lucide-react"
import { BUSINESSES } from "@/lib/constants"
import { cn } from "@/lib/utils"

interface Props {
  value: string[]
  onChange: (value: string[]) => void
}

export function BusinessMultiSelect({ value, onChange }: Props) {
  function toggle(id: string) {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {BUSINESSES.map((biz) => {
        const selected = value.includes(biz.id)
        return (
          <button
            key={biz.id}
            type="button"
            onClick={() => toggle(biz.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors min-h-[36px]",
              selected
                ? "border-transparent"
                : "border-border bg-transparent text-muted-foreground hover:text-foreground"
            )}
            style={
              selected
                ? { backgroundColor: biz.color, color: biz.textColor }
                : {}
            }
          >
            {selected && <Check size={12} strokeWidth={3} />}
            {biz.name}
          </button>
        )
      })}
    </div>
  )
}
