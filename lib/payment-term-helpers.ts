/**
 * Payment Term → Due Date auto-calculation helpers.
 *
 * Centralises the mapping from PaymentTerm enum values
 * to the number of calendar days until payment is due.
 *
 * Used by createCustomerInvoice, createInvoiceFromSalesOrder,
 * and any future function that needs to derive a due date.
 */

/** Days offset for each PaymentTerm value (matches prisma enum PaymentTerm) */
export const TERM_DAYS: Record<string, number> = {
  CASH: 0,
  COD: 0,
  NET_15: 15,
  NET_30: 30,
  NET_45: 45,
  NET_60: 60,
  NET_90: 90,
}

/**
 * Calculate the due date from a payment term and issue date.
 *
 * Falls back to NET_30 (30 days) when term is null/undefined
 * or when the term string is not recognised.
 */
export function calculateDueDate(
  term: string | null | undefined,
  issueDate: Date,
): Date {
  const days = TERM_DAYS[term || 'NET_30'] ?? 30
  const due = new Date(issueDate)
  due.setDate(due.getDate() + days)
  return due
}
