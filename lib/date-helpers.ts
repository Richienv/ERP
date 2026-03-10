import { format, formatDistanceToNow, isToday, isYesterday, differenceInDays } from "date-fns"
import { id } from "date-fns/locale"

/**
 * Parse a date input to a Date object.
 * Handles: Date, string (ISO), number (timestamp)
 */
function toDate(input: Date | string | number): Date {
  if (input instanceof Date) return input
  return new Date(input)
}

/**
 * Format date in Indonesian locale.
 *
 * @example
 * formatDate("2026-03-10")           // "10 Mar 2026"
 * formatDate("2026-03-10", "long")   // "10 Maret 2026"
 * formatDate("2026-03-10", "short")  // "10 Mar"
 * formatDate("2026-03-10", "full")   // "Senin, 10 Maret 2026"
 */
export function formatDate(
  input: Date | string | number,
  variant: "short" | "default" | "long" | "full" = "default"
): string {
  const date = toDate(input)
  switch (variant) {
    case "short":
      return format(date, "d MMM", { locale: id })
    case "default":
      return format(date, "d MMM yyyy", { locale: id })
    case "long":
      return format(date, "d MMMM yyyy", { locale: id })
    case "full":
      return format(date, "EEEE, d MMMM yyyy", { locale: id })
  }
}

/**
 * Format date with time.
 *
 * @example
 * formatDateTime("2026-03-10T14:30:00")  // "10 Mar 2026, 14:30"
 */
export function formatDateTime(input: Date | string | number): string {
  const date = toDate(input)
  return format(date, "d MMM yyyy, HH:mm", { locale: id })
}

/**
 * Format time only.
 *
 * @example
 * formatTime("2026-03-10T14:30:00")  // "14:30"
 */
export function formatTime(input: Date | string | number): string {
  const date = toDate(input)
  return format(date, "HH:mm", { locale: id })
}

/**
 * Relative date in Indonesian.
 *
 * @example
 * formatRelative(today)      // "Hari ini"
 * formatRelative(yesterday)  // "Kemarin"
 * formatRelative(3daysAgo)   // "3 hari lalu"
 * formatRelative(2weeksAgo)  // "2 minggu lalu"
 * formatRelative(oldDate)    // "10 Mar 2026" (fallback to absolute)
 */
export function formatRelative(input: Date | string | number): string {
  const date = toDate(input)

  if (isToday(date)) return "Hari ini"
  if (isYesterday(date)) return "Kemarin"

  const days = differenceInDays(new Date(), date)
  if (days < 0) {
    // Future dates
    const absDays = Math.abs(days)
    if (absDays === 1) return "Besok"
    if (absDays <= 7) return `${absDays} hari lagi`
    return formatDate(date)
  }

  if (days <= 30) {
    return formatDistanceToNow(date, { addSuffix: true, locale: id })
  }

  // Older than 30 days — show absolute date
  return formatDate(date)
}

/**
 * Format date range.
 *
 * @example
 * formatDateRange(start, end)  // "10 Mar - 15 Mar 2026"
 * formatDateRange(start, end)  // "10 Mar 2026 - 15 Apr 2026" (different months)
 */
export function formatDateRange(
  start: Date | string | number,
  end: Date | string | number
): string {
  const s = toDate(start)
  const e = toDate(end)
  const sameYear = s.getFullYear() === e.getFullYear()
  const sameMonth = sameYear && s.getMonth() === e.getMonth()

  if (sameMonth) {
    return `${format(s, "d", { locale: id })} - ${format(e, "d MMM yyyy", { locale: id })}`
  }
  if (sameYear) {
    return `${format(s, "d MMM", { locale: id })} - ${format(e, "d MMM yyyy", { locale: id })}`
  }
  return `${formatDate(s)} - ${formatDate(e)}`
}
