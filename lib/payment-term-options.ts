export const LEGACY_PAYMENT_TERM_VALUES = [
  "CASH",
  "NET_15",
  "NET_30",
  "NET_45",
  "NET_60",
  "NET_90",
  "COD",
] as const

export type LegacyPaymentTermValue = typeof LEGACY_PAYMENT_TERM_VALUES[number]

type PaymentTermLike = {
  id?: string
  code?: string | null
  name?: string | null
  days?: number | null
  isActive?: boolean
  isDefault?: boolean
  lines?: unknown[]
}

export type PaymentTermOption = {
  id: string
  code: LegacyPaymentTermValue
  name: string
  days: number
  isActive: boolean
  isDefault: boolean
  lines: unknown[]
}

const FALLBACK_PAYMENT_TERMS: Record<LegacyPaymentTermValue, PaymentTermOption> = {
  CASH: {
    id: "CASH",
    code: "CASH",
    name: "Tunai",
    days: 0,
    isActive: true,
    isDefault: false,
    lines: [],
  },
  NET_15: {
    id: "NET_15",
    code: "NET_15",
    name: "Net 15 Hari",
    days: 15,
    isActive: true,
    isDefault: false,
    lines: [],
  },
  NET_30: {
    id: "NET_30",
    code: "NET_30",
    name: "Net 30 Hari",
    days: 30,
    isActive: true,
    isDefault: true,
    lines: [],
  },
  NET_45: {
    id: "NET_45",
    code: "NET_45",
    name: "Net 45 Hari",
    days: 45,
    isActive: true,
    isDefault: false,
    lines: [],
  },
  NET_60: {
    id: "NET_60",
    code: "NET_60",
    name: "Net 60 Hari",
    days: 60,
    isActive: true,
    isDefault: false,
    lines: [],
  },
  NET_90: {
    id: "NET_90",
    code: "NET_90",
    name: "Net 90 Hari",
    days: 90,
    isActive: true,
    isDefault: false,
    lines: [],
  },
  COD: {
    id: "COD",
    code: "COD",
    name: "Bayar Saat Diterima (COD)",
    days: 0,
    isActive: true,
    isDefault: false,
    lines: [],
  },
}

export function isLegacyPaymentTerm(value: unknown): value is LegacyPaymentTermValue {
  return typeof value === "string" && LEGACY_PAYMENT_TERM_VALUES.includes(value as LegacyPaymentTermValue)
}

function normalizePaymentTermCode(code?: string | null, days?: number | null, name?: string | null): LegacyPaymentTermValue | null {
  const normalizedCode = code?.trim().toUpperCase().replace(/-/g, "_")
  if (normalizedCode) {
    if (isLegacyPaymentTerm(normalizedCode)) return normalizedCode
    if (normalizedCode === "NET15") return "NET_15"
    if (normalizedCode === "NET30") return "NET_30"
    if (normalizedCode === "NET45") return "NET_45"
    if (normalizedCode === "NET60") return "NET_60"
    if (normalizedCode === "NET90") return "NET_90"
  }

  if (typeof days === "number") {
    if (days === 15) return "NET_15"
    if (days === 30) return "NET_30"
    if (days === 45) return "NET_45"
    if (days === 60) return "NET_60"
    if (days === 90) return "NET_90"
    if (days === 0 && /cod/i.test(name || "")) return "COD"
    if (days === 0) return "CASH"
  }

  return null
}

export function getFallbackPaymentTermOptions(): PaymentTermOption[] {
  return LEGACY_PAYMENT_TERM_VALUES.map((code) => FALLBACK_PAYMENT_TERMS[code])
}

export function normalizePaymentTermOptions(terms?: PaymentTermLike[] | null): PaymentTermOption[] {
  const mapped = new Map<LegacyPaymentTermValue, PaymentTermOption>()

  for (const term of terms || []) {
    if (term?.isActive === false) continue

    const code = normalizePaymentTermCode(term?.code, term?.days, term?.name)
    if (!code) continue

    const fallback = FALLBACK_PAYMENT_TERMS[code]
    mapped.set(code, {
      id: term?.id || fallback.id,
      code,
      name: term?.name?.trim() || fallback.name,
      days: typeof term?.days === "number" ? term.days : fallback.days,
      isActive: term?.isActive ?? true,
      isDefault: term?.isDefault ?? fallback.isDefault,
      lines: Array.isArray(term?.lines) ? term.lines : fallback.lines,
    })
  }

  return LEGACY_PAYMENT_TERM_VALUES.map((code) => mapped.get(code) || FALLBACK_PAYMENT_TERMS[code])
}
