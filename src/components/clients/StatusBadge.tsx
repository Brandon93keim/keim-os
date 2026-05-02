import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Props {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: Props) {
  if (status === "active") {
    return (
      <Badge
        className={cn(
          "border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
          className
        )}
      >
        Active
      </Badge>
    )
  }
  if (status === "archived") {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        Archived
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className={className}>
      Prospect
    </Badge>
  )
}
