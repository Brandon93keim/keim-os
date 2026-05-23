import { AccountLedger } from "@/components/finance/AccountLedger"

export default async function AccountLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AccountLedger id={id} />
}
