"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: ReactNode
  backHref?: string
  onBack?: () => void
  right?: ReactNode
  below?: ReactNode
  gearGutter?: boolean
}

export function PageHeader({ title, backHref, onBack, right, below, gearGutter }: PageHeaderProps) {
  const hasBack = backHref != null || onBack != null

  const backButton = hasBack ? (
    backHref != null ? (
      <Button variant="ghost" size="icon" className="shrink-0 -ml-1" asChild>
        <Link href={backHref}>
          <ArrowLeft size={20} />
          <span className="sr-only">Back</span>
        </Link>
      </Button>
    ) : (
      <Button variant="ghost" size="icon" className="shrink-0 -ml-1" onClick={onBack}>
        <ArrowLeft size={20} />
        <span className="sr-only">Back</span>
      </Button>
    )
  ) : null

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
      <div className={cn("flex items-center gap-3 px-4 pt-4 pb-3", gearGutter && "pr-10")}>
        {backButton}
        <div
          className={cn(
            "font-semibold",
            hasBack ? "text-xl" : "text-2xl",
            (hasBack || right != null) && "flex-1 min-w-0 truncate",
          )}
        >
          {title}
        </div>
        {right}
      </div>
      {below}
    </div>
  )
}
