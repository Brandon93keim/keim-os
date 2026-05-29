const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(amount: number): string {
  return usdFormatter.format(amount)
}

export function getMonthBounds(today: string): { monthStart: string; monthEnd: string } {
  const yyyyMM = today.slice(0, 7)
  const monthStart = yyyyMM + "-01"
  const year = parseInt(yyyyMM.slice(0, 4))
  const month = parseInt(yyyyMM.slice(5, 7))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthEnd = yyyyMM + "-" + String(daysInMonth).padStart(2, "0")
  return { monthStart, monthEnd }
}
