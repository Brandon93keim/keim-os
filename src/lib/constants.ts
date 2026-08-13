// Which section of the P&L a unit rolls up into. Required (not optional) so a
// new unit can't be added without deciding where its money lands.
export type PnLGroup = "business" | "golf" | "personal"

export type Business = {
  id: string
  name: string
  color: string
  textColor: "white" | "black"
  pnl_group: PnLGroup
  invoice_logo?: string        // path under /public, e.g. "/business-logos/b-keim-rewind.png"
  invoice_display_name?: string // override `name` on invoices (used when no logo)
}

export const BUSINESSES: Business[] = [
  {
    id: "b-keim-rewind-marketing",
    name: "B Keim Rewind Marketing",
    color: "#15422E",
    textColor: "white",
    pnl_group: "business",
    invoice_logo: "/business-logos/b-keim-rewind.png",
  },
  {
    id: "happily-ever-after-weddings",
    name: "Happily Ever After Media Co",
    color: "#E11D48",
    textColor: "white",
    pnl_group: "business",
    invoice_logo: "/business-logos/happily-ever-after.png",
  },
  {
    id: "remember-when-phone-booth",
    name: "Remember When Phone Booth",
    color: "#3F1A0A",
    textColor: "white",
    pnl_group: "business",
    invoice_logo: "/business-logos/remember-when.png",
  },
  {
    id: "brandon-keim-contract-work",
    name: "Brandon Keim Contract Work",
    color: "#C026D3",
    textColor: "white",
    pnl_group: "business",
    invoice_display_name: "Brandon Keim",
  },
  {
    id: "brandon-keim-legal-work",
    name: "Brandon Keim Legal Work",
    color: "#1E3A8A",
    textColor: "white",
    pnl_group: "business",
    invoice_display_name: "Brandon Keim",
  },
  {
    id: "equipment-rental",
    name: "Equipment Rental",
    color: "#EA580C",
    textColor: "white",
    pnl_group: "business",
    invoice_display_name: "Brandon Keim",
  },
  {
    id: "keim-time",
    name: "Keim Time",
    color: "#7C3AED",
    textColor: "white",
    pnl_group: "business",
    invoice_logo: "/business-logos/keim-time.png",
  },
  {
    id: "keim-golf",
    name: "Keim Golf",
    color: "#15803D",
    textColor: "white",
    pnl_group: "golf",
    // No invoice fields — in-app scheduling only
  },
]

export const INVOICE_REMIT = {
  payee:   "Brandon Keim",
  address: "718 W 14th Ave, Covington, LA 70433",
  email:   "accounting@bkrewind.com",
  zelle:   "504-650-8070",
  paypal:  "accounting@bkrewind.com",
} as const

export const BUSINESS_PREFIXES: Record<string, string> = {
  "b-keim-rewind-marketing":    "RWND",
  "happily-ever-after-weddings": "HEAW",
  "remember-when-phone-booth":  "RWPB",
  "brandon-keim-contract-work": "BKCW",
  "brandon-keim-legal-work":    "BKLW",
  "equipment-rental":            "RENT",
  "keim-time":                   "KTME",
  "keim-golf":                   "KGLF",
}

export const GOLF_PURPOSES = [
  { value: "workout",        label: "Workout",        color: "#DC2626", textColor: "#FFFFFF" },
  { value: "practice",       label: "Practice",       color: "#84CC16", textColor: "#000000" },
  { value: "practice_round", label: "Practice Round", color: "#16A34A", textColor: "#FFFFFF" },
  { value: "tournament",     label: "Tournament",     color: "#EAB308", textColor: "#000000" },
] as const

export const EVENT_TYPE_COLORS: Record<string, string> = {
  golf: "#16A34A",     // green-600
  personal: "#0D9488", // slate-500
}

export function getBusinessById(id: string): Business | undefined {
  return BUSINESSES.find((b) => b.id === id)
}

// Unknown ids fall to "personal" to match useBusinessPnL, where a transaction
// carrying an unrecognized business_id already lands in the Personal row.
export function getPnLGroup(businessId: string | null): PnLGroup {
  if (!businessId) return "personal"
  return getBusinessById(businessId)?.pnl_group ?? "personal"
}

export function getBusinessPrefix(id: string): string {
  return BUSINESS_PREFIXES[id] ?? id.toUpperCase().slice(0, 4)
}

export function shortJobNumber(full: string | null | undefined): string {
  if (!full) return ""
  const parts = full.split("-")
  if (parts.length !== 3) return full
  return `${parts[0]}-${parts[2]}`
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
