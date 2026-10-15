"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { ChevronDown, MapPinOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { getBusinessById } from "@/lib/constants"
import { useEventsMissingLocation, useSetEventLocation } from "@/lib/hooks/useMileage"

function Row({ id, title, date, businessId, listId }: { id: string; title: string; date: string; businessId: string | null; listId: string }) {
  const [value, setValue] = useState("")
  const save = useSetEventLocation()
  const b = businessId ? getBusinessById(businessId) : null
  return (
    <div className="rounded-lg bg-background px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: b?.color ?? "#999" }} />
        <span className="text-sm font-medium truncate">{title}</span>
        <span className="ml-auto text-xs text-muted-foreground shrink-0">{format(parseISO(date), "MMM d")}</span>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) save.mutate({ id, location: value })
        }}
      >
        <Input
          list={listId}
          placeholder="Address or city, state"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9"
        />
        <Button type="submit" size="sm" disabled={!value.trim() || save.isPending}>
          Save
        </Button>
      </form>
    </div>
  )
}

/** Business events with no location log zero miles. Fill them in here; it updates the calendar event. */
export function MileageMissingLocations({ from, to, knownPlaces }: { from: string; to: string; knownPlaces: string[] }) {
  const { data: missing = [] } = useEventsMissingLocation(from, to)
  const [open, setOpen] = useState(false)
  if (!missing.length) return null
  const listId = "mileage-known-places"
  return (
    <div className="rounded-xl bg-muted/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm"
      >
        <MapPinOff size={16} className="shrink-0 text-muted-foreground" />
        <span className="flex-1">
          <span className="font-medium">{missing.length} job{missing.length === 1 ? "" : "s"} missing a location</span>
          <span className="text-muted-foreground"> · no miles until you add one</span>
        </span>
        <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1.5">
          <datalist id={listId}>
            {knownPlaces.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          {missing.map((e) => (
            <Row key={e.id} id={e.id} title={e.title} date={e.date} businessId={e.business_id} listId={listId} />
          ))}
          <p className="px-1 pt-1 text-xs text-muted-foreground">
            Saving updates the calendar event. Tap Sync afterward to add the miles.
          </p>
        </div>
      )}
    </div>
  )
}
