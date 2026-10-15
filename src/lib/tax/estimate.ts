// Pure estimated-tax math for a sole proprietor. No network, no DB.
// Planning numbers only: ignores credits, other income, itemizing, and QBI
// phase-outs (well above this income range for a single filer).
import { taxYear, type FilingStatus, type TaxYearConstants } from "./constants"

export type TaxInputs = {
  year: number
  filingStatus: FilingStatus
  /** Schedule C profit after all deductions incl. mileage, before retirement contributions. */
  netProfit: number
  otherOrdinaryIncome?: number // interest etc.
  solo401kDeferral?: number
  solo401kEmployer?: number
}

export type TaxEstimate = {
  netProfit: number
  seEarnings: number
  seTax: number
  halfSeTax: number
  retirementDeduction: number
  agi: number
  qbiDeduction: number
  taxableIncome: number
  federalIncomeTax: number
  federalTotal: number // income tax + SE tax
  laTaxable: number
  laTax: number
  totalTax: number
  effectiveRate: number // totalTax / netProfit
  marginalFederalRate: number
  maxEmployerContribution: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function bracketTax(taxable: number, c: TaxYearConstants, status: FilingStatus): { tax: number; marginal: number } {
  let tax = 0
  let lower = 0
  let marginal = c.brackets[status][0].rate
  for (const b of c.brackets[status]) {
    if (taxable <= lower) break
    const top = Math.min(taxable, b.upTo)
    tax += (top - lower) * b.rate
    marginal = b.rate
    lower = b.upTo
  }
  return { tax, marginal }
}

export function selfEmploymentTax(netProfit: number, c: TaxYearConstants, status: FilingStatus) {
  const seEarnings = Math.max(0, netProfit) * 0.9235
  if (seEarnings < 400) return { seEarnings, seTax: 0 }
  const ss = Math.min(seEarnings, c.ssWageBase) * 0.124
  const medicare = seEarnings * 0.029
  const addl = Math.max(0, seEarnings - c.addlMedicareThreshold[status]) * 0.009
  return { seEarnings, seTax: ss + medicare + addl }
}

/** Max Solo 401(k) employer (profit-sharing) contribution for a sole proprietor: 20% of net SE earnings. */
export function maxEmployerContribution(netProfit: number, c: TaxYearConstants, status: FilingStatus): number {
  const { seTax } = selfEmploymentTax(netProfit, c, status)
  return Math.max(0, (Math.max(0, netProfit) - seTax / 2) * 0.2)
}

export function estimateTax(input: TaxInputs): TaxEstimate {
  const c = taxYear(input.year)
  const s = input.filingStatus
  const netProfit = input.netProfit
  const { seEarnings, seTax } = selfEmploymentTax(netProfit, c, s)
  const halfSeTax = seTax / 2

  const maxEmp = maxEmployerContribution(netProfit, c, s)
  const deferral = Math.min(Math.max(0, input.solo401kDeferral ?? 0), c.k401DeferralLimit, Math.max(0, netProfit - halfSeTax))
  const employer = Math.min(Math.max(0, input.solo401kEmployer ?? 0), maxEmp, c.k401TotalLimit - deferral)
  const retirementDeduction = deferral + employer

  const agi = Math.max(0, netProfit) - halfSeTax - retirementDeduction + (input.otherOrdinaryIncome ?? 0)
  const preQbiTaxable = Math.max(0, agi - c.standardDeduction[s])
  const qbi = Math.max(0, netProfit - halfSeTax - retirementDeduction)
  const qbiDeduction = Math.min(0.2 * qbi, 0.2 * preQbiTaxable)
  const taxableIncome = Math.max(0, preQbiTaxable - qbiDeduction)
  const { tax: federalIncomeTax, marginal } = bracketTax(taxableIncome, c, s)

  // Louisiana starts from federal AGI.
  const laTaxable = Math.max(0, agi - c.la.standardDeduction[s])
  const laTax = laTaxable * c.la.rate

  const federalTotal = federalIncomeTax + seTax
  const totalTax = federalTotal + laTax
  return {
    netProfit: r2(netProfit),
    seEarnings: r2(seEarnings),
    seTax: r2(seTax),
    halfSeTax: r2(halfSeTax),
    retirementDeduction: r2(retirementDeduction),
    agi: r2(agi),
    qbiDeduction: r2(qbiDeduction),
    taxableIncome: r2(taxableIncome),
    federalIncomeTax: r2(federalIncomeTax),
    federalTotal: r2(federalTotal),
    laTaxable: r2(laTaxable),
    laTax: r2(laTax),
    totalTax: r2(totalTax),
    effectiveRate: netProfit > 0 ? totalTax / netProfit : 0,
    marginalFederalRate: marginal,
    maxEmployerContribution: r2(maxEmp),
  }
}

/** Fraction of the tax year elapsed through `asOf` (YYYY-MM-DD). */
export function yearFraction(year: number, asOf: string): number {
  const start = Date.UTC(year, 0, 1)
  const end = Date.UTC(year + 1, 0, 1)
  const d = Date.parse(asOf + "T12:00:00Z")
  return Math.min(1, Math.max(1 / 365, (d - start) / (end - start)))
}

export type Installment = {
  n: 1 | 2 | 3 | 4
  due: string
  cumulativeRequired: number
  paidByDue: number
  /** Still needed (cumulatively) as of today to be caught up through this installment. */
  shortfall: number
  /** paid = covered by its due date; caught_up = covered after the due date (penalty accrued while late);
   *  late = due date passed and still not covered; due = next deadline; upcoming = later deadline. */
  status: "paid" | "caught_up" | "late" | "due" | "upcoming"
}

export function installmentPlan(opts: {
  requiredAnnual: number
  dueDates: [string, string, string, string]
  payments: { paid_on: string; amount: number }[]
  today: string
}): Installment[] {
  const per = opts.requiredAnnual / 4
  const paidSoFar = opts.payments.reduce((s, p) => s + p.amount, 0)
  const nextIdx = opts.dueDates.findIndex((d) => d >= opts.today)
  return opts.dueDates.map((due, i) => {
    const cumulativeRequired = r2(per * (i + 1))
    const paidByDue = r2(opts.payments.filter((p) => p.paid_on <= due).reduce((s, p) => s + p.amount, 0))
    const coveredByDue = paidByDue >= cumulativeRequired - 0.005
    const coveredNow = paidSoFar >= cumulativeRequired - 0.005
    const past = opts.today > due
    let status: Installment["status"]
    if (coveredByDue) status = "paid"
    else if (past) status = coveredNow ? "caught_up" : "late"
    else status = coveredNow ? "paid" : i === nextIdx ? "due" : "upcoming"
    return {
      n: (i + 1) as Installment["n"],
      due,
      cumulativeRequired,
      paidByDue,
      shortfall: r2(Math.max(0, cumulativeRequired - paidSoFar)),
      status,
    }
  })
}

/**
 * Federal safe harbor: the smaller of 90% of this year's tax or 100% of last
 * year's (110% if last year's AGI was over $150k), paid in four equal installments.
 */
export function federalRequiredAnnual(opts: {
  projectedFederalTotal: number
  priorYearTax: number | null
  priorYearAgiOver150k: boolean
}): { required: number; basis: "prior-year" | "current-year" } {
  const current = 0.9 * opts.projectedFederalTotal
  if (opts.priorYearTax == null) return { required: r2(current), basis: "current-year" }
  const prior = opts.priorYearTax * (opts.priorYearAgiOver150k ? 1.1 : 1)
  return prior <= current
    ? { required: r2(prior), basis: "prior-year" }
    : { required: r2(current), basis: "current-year" }
}
