export type Business = {
  id: string
  name: string
  color: string
  textColor: "white" | "black"
}

export const BUSINESSES: Business[] = [
  {
    id: "b-keim-rewind-marketing",
    name: "B Keim Rewind Marketing",
    color: "#0D9488",
    textColor: "white",
  },
  {
    id: "happily-ever-after-weddings",
    name: "Happily Ever After Weddings",
    color: "#E11D48",
    textColor: "white",
  },
  {
    id: "remember-when-phone-booth",
    name: "Remember When Phone Booth",
    color: "#B45309",
    textColor: "white",
  },
  {
    id: "brandon-keim-contract-work",
    name: "Brandon Keim Contract Work",
    color: "#475569",
    textColor: "white",
  },
  {
    id: "brandon-keim-legal-work",
    name: "Brandon Keim Legal Work",
    color: "#1E3A8A",
    textColor: "white",
  },
  {
    id: "equipment-rental",
    name: "Equipment Rental",
    color: "#EA580C",
    textColor: "white",
  },
  {
    id: "keim-time",
    name: "Keim Time",
    color: "#7C3AED",
    textColor: "white",
  },
]

export const BUSINESS_PREFIXES: Record<string, string> = {
  "b-keim-rewind-marketing":    "RWND",
  "happily-ever-after-weddings": "HEAW",
  "remember-when-phone-booth":  "RWPB",
  "brandon-keim-contract-work": "BKCW",
  "brandon-keim-legal-work":    "BKLW",
  "equipment-rental":            "RENT",
  "keim-time":                   "KTME",
}

export const GOLF_PURPOSES = [
  { value: "workout",        label: "Workout",        color: "#DC2626", textColor: "#FFFFFF" },
  { value: "practice",       label: "Practice",       color: "#0EA5E9", textColor: "#FFFFFF" },
  { value: "practice_round", label: "Practice Round", color: "#16A34A", textColor: "#FFFFFF" },
  { value: "tournament",     label: "Tournament",     color: "#EAB308", textColor: "#000000" },
] as const

export const EVENT_TYPE_COLORS: Record<string, string> = {
  golf: "#16A34A",     // green-600
  personal: "#64748B", // slate-500
}

export function getBusinessById(id: string): Business | undefined {
  return BUSINESSES.find((b) => b.id === id)
}

export function getBusinessPrefix(id: string): string {
  return BUSINESS_PREFIXES[id] ?? id.toUpperCase().slice(0, 4)
}

type EventColorInput = {
  business_id: string | null
  type: string
  golf_purpose?: string | null
}

export function colorForEvent(event: EventColorInput): string {
  if (event.business_id) {
    const biz = BUSINESSES.find((b) => b.id === event.business_id)
    if (biz) return biz.color
  }
  if (event.type === "golf" && event.golf_purpose) {
    const p = GOLF_PURPOSES.find((g) => g.value === event.golf_purpose)
    if (p) return p.color
  }
  if (event.type === "golf") return "#16A34A"
  if (event.type in EVENT_TYPE_COLORS) {
    return EVENT_TYPE_COLORS[event.type]
  }
  return "#9CA3AF"
}
