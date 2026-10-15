// Home office deduction (Form 8829 / simplified method). Pure math.
// Requires regular and exclusive business use of the space.

export type HomeOfficeInputs = {
  year: number
  officeSqft: number
  homeSqft: number
  utilitiesAnnual: number   // electric, gas, water for the whole home
  insuranceAnnual: number   // homeowners insurance
  propertyTaxAnnual: number
  buildingBasis: number     // what you paid for the house minus land value
  inServiceDate: string | null // when the office started being used (YYYY-MM-DD)
  method: "auto" | "simplified" | "actual"
}

export type HomeOfficeResult = {
  businessPct: number
  simplified: number
  actualExpenses: number
  depreciation: number
  actual: number
  method: "simplified" | "actual"
  deduction: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** 39-year straight line, mid-month convention in the first year. */
export function officeDepreciation(basis: number, pct: number, inService: string | null, year: number): number {
  if (!basis || !pct || !inService) return 0
  const startYear = Number(inService.slice(0, 4))
  const month = Number(inService.slice(5, 7))
  if (year < startYear) return 0
  const fraction = year === startYear ? (12 - month + 0.5) / 12 : 1
  return (basis * pct * fraction) / 39
}

export function homeOffice(i: HomeOfficeInputs): HomeOfficeResult {
  const pct = i.homeSqft > 0 ? Math.min(1, i.officeSqft / i.homeSqft) : 0
  const simplified = Math.min(300, Math.max(0, i.officeSqft)) * 5
  const actualExpenses = pct * (i.utilitiesAnnual + i.insuranceAnnual + i.propertyTaxAnnual)
  const depreciation = officeDepreciation(i.buildingBasis, pct, i.inServiceDate, i.year)
  const actual = actualExpenses + depreciation
  const method = i.method === "auto" ? (actual > simplified ? "actual" : "simplified") : i.method
  return {
    businessPct: pct,
    simplified: r2(simplified),
    actualExpenses: r2(actualExpenses),
    depreciation: r2(depreciation),
    actual: r2(actual),
    method,
    deduction: r2(method === "actual" ? actual : simplified),
  }
}
