import type { Invoice, InvoiceLineItem, Payment, InvoiceClient } from "@/lib/queries/invoices"
import type { Business } from "@/lib/constants"

interface UserProfile {
  full_name: string | null
  email: string | null
  phone: string | null
}

export async function generateInvoiceBlob(
  invoice: Invoice,
  lineItems: InvoiceLineItem[],
  payments: Payment[],
  client: InvoiceClient | null,
  business: Business,
  userProfile: UserProfile,
): Promise<Blob> {
  const [{ pdf }, { default: InvoicePdfDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/invoices/InvoicePdfDocument"),
  ])
  const blob = await pdf(
    <InvoicePdfDocument
      invoice={invoice}
      lineItems={lineItems}
      payments={payments}
      client={client}
      business={business}
      userProfile={userProfile}
    />
  ).toBlob()
  return blob
}

export async function downloadInvoicePdf(
  invoice: Invoice,
  lineItems: InvoiceLineItem[],
  payments: Payment[],
  client: InvoiceClient | null,
  business: Business,
  userProfile: UserProfile,
): Promise<void> {
  const blob = await generateInvoiceBlob(
    invoice, lineItems, payments, client, business, userProfile,
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${invoice.invoice_number ?? "invoice"}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
