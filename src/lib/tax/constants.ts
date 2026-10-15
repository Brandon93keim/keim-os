// Tax-year constants. Add a new year when the IRS / LDR publish figures.
// Sources (2026): IRS inflation adjustments (brackets, standard deduction),
// IRS 2026 retirement limits (IRA $7,500, 401(k) deferral $24,500,
// Roth phase-out $153k-$168k single), SSA 2026 wage base,
// Louisiana Act 11 (2024 3rd ex. sess.): flat 3%, std deduction $12,500 single
// in 2025, CPI-indexed from 2026 (2025 figure used, so LA is slightly overstated).

export type FilingStatus = "single" | "mfj"

export type Bracket = { upTo: number; rate: number } // upTo = Infinity for the top bracket

export type TaxYearConstants = {
  year: number
  standardDeduction: Record<FilingStatus, number>
  brackets: Record<FilingStatus, Bracket[]>
  ssWageBase: number
  addlMedicareThreshold: Record<FilingStatus, number>
  iraLimit: number
  k401DeferralLimit: number
  k401TotalLimit: number // employee + employer, under 50
  rothPhaseOut: Record<FilingStatus, [number, number]>
  la: { rate: number; standardDeduction: Record<FilingStatus, number>; estimateThreshold: Record<FilingStatus, number> }
  // Quarterly estimate due dates (installments 1-4) for this tax year
  dueDates: [string, string, string, string]
}

export const TAX_YEARS: Record<number, TaxYearConstants> = {
  2026: {
    year: 2026,
    standardDeduction: { single: 16100, mfj: 32200 },
    brackets: {
      single: [
        { upTo: 12400, rate: 0.1 },
        { upTo: 50400, rate: 0.12 },
        { upTo: 105700, rate: 0.22 },
        { upTo: 201775, rate: 0.24 },
        { upTo: 256225, rate: 0.32 },
        { upTo: 640600, rate: 0.35 },
        { upTo: Infinity, rate: 0.37 },
      ],
      mfj: [
        { upTo: 24800, rate: 0.1 },
        { upTo: 100800, rate: 0.12 },
        { upTo: 211400, rate: 0.22 },
        { upTo: 403550, rate: 0.24 },
        { upTo: 512450, rate: 0.32 },
        { upTo: 768700, rate: 0.35 },
        { upTo: Infinity, rate: 0.37 },
      ],
    },
    ssWageBase: 184500,
    addlMedicareThreshold: { single: 200000, mfj: 250000 },
    iraLimit: 7500,
    k401DeferralLimit: 24500,
    k401TotalLimit: 72000,
    rothPhaseOut: { single: [153000, 168000], mfj: [242000, 252000] },
    la: {
      rate: 0.03,
      standardDeduction: { single: 12500, mfj: 25000 },
      estimateThreshold: { single: 1000, mfj: 2000 },
    },
    dueDates: ["2026-04-15", "2026-06-15", "2026-09-15", "2027-01-15"],
  },
}

export function taxYear(year: number): TaxYearConstants {
  const c = TAX_YEARS[year]
  if (c) return c
  // Fall back to the latest known year so the page still works; UI flags it.
  const latest = Math.max(...Object.keys(TAX_YEARS).map(Number))
  return { ...TAX_YEARS[latest], year }
}

export function hasOfficialYear(year: number): boolean {
  return TAX_YEARS[year] != null
}
