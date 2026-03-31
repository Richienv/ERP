export const NPWP_ALLOWED_LENGTHS = [15, 16] as const

export function getNpwpDigits(value?: string | null): string {
  return (value || "").replace(/\D/g, "")
}

export function isValidNpwp(value?: string | null): boolean {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (!/^[\d.\-\s]+$/.test(trimmed)) return false

  const digitsLength = getNpwpDigits(trimmed).length
  return NPWP_ALLOWED_LENGTHS.includes(digitsLength as (typeof NPWP_ALLOWED_LENGTHS)[number])
}

export function formatNpwp(value?: string | null): string {
  const digits = getNpwpDigits(value).slice(0, 16)
  let formatted = ""

  if (digits.length > 0) formatted += digits.slice(0, 2)
  if (digits.length > 2) formatted += "." + digits.slice(2, 5)
  if (digits.length > 5) formatted += "." + digits.slice(5, 8)
  if (digits.length > 8) formatted += "." + digits.slice(8, 9)
  if (digits.length > 9) formatted += "-" + digits.slice(9, 12)
  if (digits.length > 12) formatted += "." + digits.slice(12, 16)

  return formatted
}
