import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatIDR(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Key alias for compatibility
export const formatCurrency = formatIDR;

export function formatCompactNumber(number: number) {
  return Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number)
}

/**
 * Format number as Indonesian Rupiah with explicit control over decimals
 * @param amount - The amount to format
 * @param withDecimals - Include ,00 decimals (default: true for accounting)
 */
export function formatRupiah(amount: number | string, withDecimals = true) {
  const num = Number(amount)
  if (isNaN(num)) return 'Rp 0'

  if (withDecimals) {
    // Format: Rp 194.250,00 (accounting standard)
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num).replace('Rp', 'Rp ') // Ensure space after Rp
  } else {
    // Format: Rp 194.250 (common for unit prices)
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num).replace('Rp', 'Rp ')
  }
}
