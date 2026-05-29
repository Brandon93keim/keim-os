import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer"
import { format, parseISO } from "date-fns"
import { getEffectiveStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/invoiceStatus"
import type { Invoice, InvoiceLineItem, Payment, InvoiceClient } from "@/lib/queries/invoices"
import type { Business } from "@/lib/constants"
import { INVOICE_REMIT } from "@/lib/constants"

interface Props {
  invoice: Invoice
  lineItems: InvoiceLineItem[]
  payments: Payment[]
  client: InvoiceClient | null
  business: Business
  userProfile: {
    full_name: string | null
    email: string | null
    phone: string | null
  }
}


const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111827",
    paddingTop: 36,
    paddingBottom: 60,
    paddingLeft: 36,
    paddingRight: 36,
  },

  // ── Header band ──────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 60,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderRadius: 4,
  },
  headerBizName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
  },
  headerNumber: {
    color: "#FFFFFF",
    fontSize: 10,
    marginTop: 2,
  },

  // ── Bill From / Bill To ───────────────────────────────────────────────────
  billingRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  billingCol: {
    flex: 1,
  },
  billingLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  billingBold: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  billingMed: {
    fontSize: 10,
    marginBottom: 2,
  },
  billingText: {
    fontSize: 9,
    color: "#374151",
    marginBottom: 1,
  },

  // ── Metadata strip ────────────────────────────────────────────────────────
  metaStrip: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 20,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 9,
    color: "#111827",
  },
  statusPill: {
    borderRadius: 4,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 6,
    paddingRight: 6,
    alignSelf: "flex-start",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },

  // ── Line items table ──────────────────────────────────────────────────────
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F3F4F6",
  },
  thDesc: { width: "60%", paddingRight: 4 },
  thQty:  { width: "10%", textAlign: "right" },
  thPrice:{ width: "15%", textAlign: "right" },
  thTot:  { width: "15%", textAlign: "right" },
  thText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    textTransform: "uppercase",
  },
  tdDesc: { width: "60%", paddingRight: 4 },
  tdQty:  { width: "10%", textAlign: "right" },
  tdPrice:{ width: "15%", textAlign: "right" },
  tdTot:  { width: "15%", textAlign: "right" },
  tdText: { fontSize: 9, color: "#111827" },

  // ── Totals block ──────────────────────────────────────────────────────────
  totalsBlock: {
    alignSelf: "flex-end",
    width: "40%",
    marginTop: 10,
    marginBottom: 20,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsLabel: { fontSize: 9, color: "#374151" },
  totalsValue: { fontSize: 9, color: "#111827" },
  totalsDivider: {
    borderTopWidth: 1,
    borderTopColor: "#D1D5DB",
    marginVertical: 4,
  },
  totalsFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 2,
  },
  totalsFinalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#111827" },
  totalsFinalValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#111827" },

  // ── Section title ─────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 6,
    marginTop: 16,
  },

  // ── Payments ─────────────────────────────────────────────────────────────
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F3F4F6",
  },
  paymentDate: { fontSize: 9, color: "#374151" },
  paymentAmt:  { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111827" },

  // ── Notes / Terms ─────────────────────────────────────────────────────────
  bodyText: {
    fontSize: 9,
    color: "#374151",
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    paddingTop: 5,
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#9CA3AF",
  },
})

export default function InvoicePdfDocument({
  invoice,
  lineItems,
  payments,
  client,
  business,
  userProfile,
}: Props) {
  const effectiveStatus = getEffectiveStatus(invoice)
  const statusColor = STATUS_COLORS[effectiveStatus]
  const now = new Date()

  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* Header band */}
        <View style={[s.header, { backgroundColor: business.color }]}>
          {business.invoice_logo ? (
            <Image
              src={business.invoice_logo}
              style={{ width: 140, height: "auto", maxHeight: 60, objectFit: "contain" }}
            />
          ) : (
            <Text style={s.headerBizName}>
              {business.invoice_display_name ?? business.name}
            </Text>
          )}
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>INVOICE</Text>
            {invoice.invoice_number && (
              <Text style={s.headerNumber}>{invoice.invoice_number}</Text>
            )}
          </View>
        </View>

        {/* Bill From / Bill To */}
        <View style={s.billingRow}>
          <View style={s.billingCol}>
            <Text style={s.billingLabel}>Bill From</Text>
            {userProfile.full_name && (
              <Text style={s.billingText}>{userProfile.full_name}</Text>
            )}
            <Text style={s.billingText}>{INVOICE_REMIT.email}</Text>
            {userProfile.phone && (
              <Text style={s.billingText}>{userProfile.phone}</Text>
            )}
          </View>
          <View style={s.billingCol}>
            <Text style={s.billingLabel}>Bill To</Text>
            {client ? (
              <>
                {client.company && (
                  <Text style={s.billingBold}>{client.company}</Text>
                )}
                <Text style={s.billingMed}>{client.name}</Text>
                {client.email && (
                  <Text style={s.billingText}>{client.email}</Text>
                )}
              </>
            ) : (
              <Text style={s.billingText}>—</Text>
            )}
          </View>
        </View>

        {/* Metadata strip */}
        <View style={s.metaStrip}>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>Issue Date</Text>
            <Text style={s.metaValue}>
              {format(parseISO(invoice.issue_date), "MMM d, yyyy")}
            </Text>
          </View>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>Due Date</Text>
            <Text style={s.metaValue}>
              {format(parseISO(invoice.due_date), "MMM d, yyyy")}
            </Text>
          </View>
          <View style={s.metaCol}>
            <Text style={s.metaLabel}>Status</Text>
            <View style={[s.statusPill, { backgroundColor: statusColor }]}>
              <Text style={s.statusText}>
                {STATUS_LABELS[effectiveStatus]}
              </Text>
            </View>
          </View>
        </View>

        {/* Line items table */}
        <View style={s.tableHeaderRow}>
          <Text style={[s.thText, s.thDesc]}>Description</Text>
          <Text style={[s.thText, s.thQty]}>Qty</Text>
          <Text style={[s.thText, s.thPrice]}>Unit Price</Text>
          <Text style={[s.thText, s.thTot]}>Total</Text>
        </View>

        {lineItems.length === 0 ? (
          <View style={[s.tableRow, { justifyContent: "center" }]}>
            <Text style={[s.tdText, { color: "#9CA3AF" }]}>No line items</Text>
          </View>
        ) : (
          lineItems.map((item) => (
            <View key={item.id} style={s.tableRow}>
              <Text style={[s.tdText, s.tdDesc]}>{item.description}</Text>
              <Text style={[s.tdText, s.tdQty]}>{item.quantity}</Text>
              <Text style={[s.tdText, s.tdPrice]}>{fmt.format(item.unit_price)}</Text>
              <Text style={[s.tdText, s.tdTot]}>{fmt.format(item.amount)}</Text>
            </View>
          ))
        )}

        {/* Totals */}
        <View style={s.totalsBlock}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Subtotal</Text>
            <Text style={s.totalsValue}>{fmt.format(invoice.subtotal)}</Text>
          </View>
          {invoice.tax_rate > 0 && (
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Tax ({invoice.tax_rate}%)</Text>
              <Text style={s.totalsValue}>{fmt.format(invoice.tax_amount)}</Text>
            </View>
          )}
          <View style={s.totalsDivider} />
          <View style={s.totalsFinalRow}>
            <Text style={s.totalsFinalLabel}>Total</Text>
            <Text style={s.totalsFinalValue}>{fmt.format(invoice.total)}</Text>
          </View>
        </View>

        {/* Payments */}
        {payments.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>Payments Received</Text>
            {payments.map((pmt) => (
              <View key={pmt.id} style={s.paymentRow}>
                <Text style={s.paymentDate}>
                  {format(parseISO(pmt.payment_date), "MMM d, yyyy")}
                  {" · "}
                  {titleCase(pmt.method)}
                </Text>
                <Text style={s.paymentAmt}>{fmt.format(pmt.amount)}</Text>
              </View>
            ))}
            <View style={[s.totalsRow, { marginTop: 8 }]}>
              <Text style={s.totalsLabel}>Amount Paid</Text>
              <Text style={s.totalsValue}>{fmt.format(invoice.amount_paid)}</Text>
            </View>
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Balance Due</Text>
              <Text style={s.totalsValue}>
                {fmt.format(Math.max(0, invoice.total - invoice.amount_paid))}
              </Text>
            </View>
          </View>
        )}

        {/* Payment Options */}
        <View>
          <Text style={s.sectionTitle}>Payment Options</Text>
          <Text style={s.bodyText}>
            Make checks payable to {INVOICE_REMIT.payee}, mail to: {INVOICE_REMIT.address}
          </Text>
          <Text style={s.bodyText}>Zelle: {INVOICE_REMIT.zelle}</Text>
          <Text style={s.bodyText}>PayPal: {INVOICE_REMIT.paypal}</Text>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View>
            <Text style={s.sectionTitle}>Notes</Text>
            <Text style={s.bodyText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Terms */}
        {invoice.terms && (
          <View>
            <Text style={s.sectionTitle}>Terms</Text>
            <Text style={s.bodyText}>{invoice.terms}</Text>
          </View>
        )}

        {/* Footer — renders on every page */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {business.name} · Generated {format(now, "MMM d, yyyy")}
          </Text>
        </View>

      </Page>
    </Document>
  )
}
