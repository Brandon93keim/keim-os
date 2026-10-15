"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BUSINESSES } from "@/lib/constants"
import {
  useCreateManualTrip,
  useDeleteTrip,
  useUpdateTrip,
  type MileageTrip,
} from "@/lib/hooks/useMileage"

interface Props {
  open: boolean
  onClose: () => void
  trip?: MileageTrip // undefined = new manual trip
}

const BIZ = BUSINESSES.filter((b) => b.pnl_group !== "personal")

export function MileageTripSheet({ open, onClose, trip }: Props) {
  const create = useCreateManualTrip()
  const update = useUpdateTrip()
  const del = useDeleteTrip()

  const [date, setDate] = useState("")
  const [business, setBusiness] = useState<string>("")
  const [purpose, setPurpose] = useState("")
  const [destination, setDestination] = useState("")
  const [miles, setMiles] = useState("")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!open) return
    setDate(trip?.trip_date ?? format(new Date(), "yyyy-MM-dd"))
    setBusiness(trip?.business_id ?? BIZ[0]?.id ?? "")
    setPurpose(trip?.purpose ?? "")
    setDestination(trip?.destination ?? "")
    setMiles(trip ? String(Number(trip.miles)) : "")
    setNotes(trip?.notes ?? "")
  }, [open, trip])

  const milesNum = Number(miles)
  const valid = date && purpose.trim() && destination.trim() && miles !== "" && Number.isFinite(milesNum) && milesNum >= 0
  const busy = create.isPending || update.isPending || del.isPending

  async function save(status?: MileageTrip["status"]) {
    if (!valid) return
    const values = {
      trip_date: date,
      business_id: business || null,
      purpose: purpose.trim(),
      destination: destination.trim(),
      miles: Math.round(milesNum * 10) / 10,
      notes: notes.trim() || null,
    }
    if (trip) await update.mutateAsync({ trip, values: status ? { ...values, status } : values })
    else await create.mutateAsync(values)
    onClose()
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] rounded-t-2xl p-0 gap-0 flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle>{trip ? "Trip" : "Add trip"}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {trip?.status === "review" && trip.review_reason && (
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              {trip.review_reason}
            </div>
          )}
          {trip?.status === "ok" && trip.review_reason && (
            <p className="text-xs text-muted-foreground">{trip.review_reason}</p>
          )}
          {trip?.source === "auto" && (
            <p className="text-xs text-muted-foreground">
              From your calendar. Route: {trip.from_label ?? "Home"} → {trip.destination}
              {trip.includes_return ? " → Home" : ""}. Changing the miles locks them so a sync won&apos;t overwrite them.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="trip-date">Date</Label>
              <Input id="trip-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-miles">Miles</Label>
              <Input
                id="trip-miles"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Business</Label>
            <Select value={business} onValueChange={setBusiness}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BIZ.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trip-purpose">Business purpose</Label>
            <Input
              id="trip-purpose"
              placeholder="e.g. Picked up rental lens for Gun Talk shoot"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trip-dest">Destination</Label>
            <Input id="trip-dest" value={destination} onChange={(e) => setDestination(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trip-notes">Notes</Label>
            <Textarea id="trip-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="border-t border-border px-4 py-3 shrink-0 space-y-2" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          {trip?.status === "review" && (
            <Button className="w-full" disabled={!valid || busy} onClick={() => save("ok")}>
              Looks right, confirm
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              variant={trip?.status === "review" ? "secondary" : "default"}
              disabled={!valid || busy}
              onClick={() => save()}
            >
              Save
            </Button>
          </div>
          {trip && (
            <div className="flex gap-2">
              {trip.status !== "excluded" ? (
                <Button
                  variant="ghost"
                  className="flex-1 text-muted-foreground"
                  disabled={busy}
                  onClick={() => save("excluded")}
                >
                  Not a business drive
                </Button>
              ) : (
                <Button variant="ghost" className="flex-1" disabled={busy} onClick={() => save("ok")}>
                  Count this trip again
                </Button>
              )}
              {trip.source === "manual" && (
                <Button
                  variant="ghost"
                  className="flex-1 text-red-600"
                  disabled={busy}
                  onClick={async () => {
                    await del.mutateAsync(trip.id)
                    onClose()
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
