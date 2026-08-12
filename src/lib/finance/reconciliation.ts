import { format } from "date-fns"

// A revolving card's balance only moves when a payment is recorded — the
// charges never are — so it drifts below what's actually owed. Reconciling
// writes one adjusting row that closes the gap against a statement, mirroring
// the manual convention already used for bank reconciliations: excluded from
// P&L, no category, described "{account} reconciliation to {source} {M/d}".
export const RECONCILIATION_MARKER = "reconciliation to statement"

export function reconciliationDescription(accountName: string, date: Date): string {
  return `${accountName} ${RECONCILIATION_MARKER} ${format(date, "M/d")}`
}

// The marker doubles as the only way to spot these rows later — there's no
// dedicated column, so "last reconciled" is derived from the description.
export function isReconciliationDescription(description: string): boolean {
  return description.includes(RECONCILIATION_MARKER)
}

export type ReconciliationDelta = {
  type: "income" | "expense"
  amount: number
}

/**
 * `currentBalance` is the account's signed balance (a card that owes $1,200
 * reads -1200); `statementBalance` is the amount owed off the statement,
 * entered unsigned. Returns the single transaction that closes the gap, or
 * null when the two already agree to the cent.
 *
 * Balance has to fall (more negative → unrecorded charges, the usual case) →
 * expense. Balance has to rise (refund or overpayment) → income.
 */
export function reconciliationDelta(
  currentBalance: number,
  statementBalance: number
): ReconciliationDelta | null {
  const target = -Math.abs(statementBalance)
  const delta = Math.round((target - currentBalance) * 100) / 100
  if (delta === 0) return null
  return delta < 0
    ? { type: "expense", amount: Math.abs(delta) }
    : { type: "income", amount: delta }
}
