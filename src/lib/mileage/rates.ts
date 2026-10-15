// IRS business standard mileage rates (dollars per mile).
// 2026: 72.5 cents (IRS IR-2025-128). Add each new year when the IRS announces it.
export const IRS_MILEAGE_RATES: Record<number, number> = {
  2024: 0.67,
  2025: 0.7,
  2026: 0.725,
}

export function mileageRateFor(year: number): { rate: number; official: boolean } {
  if (IRS_MILEAGE_RATES[year] != null) return { rate: IRS_MILEAGE_RATES[year], official: true }
  const latest = Math.max(...Object.keys(IRS_MILEAGE_RATES).map(Number))
  return { rate: IRS_MILEAGE_RATES[latest], official: false }
}
