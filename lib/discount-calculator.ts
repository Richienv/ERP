/**
 * Discount Calculator — CSA-013
 *
 * Calculates applicable discounts for quotation/SO line items.
 * Supports: PERCENTAGE, FIXED, and TIERED (quantity-based) discounts.
 *
 * Textile industry uses tiered discounts heavily:
 *   - Beli 100m → diskon 5%
 *   - Beli 500m → diskon 10%
 *   - Beli 1000m → diskon 15%
 */

// ─── Types ───────────────────────────────────────────────────────────────

export type TieredRule = {
    minQty: number
    maxQty: number | null // null = unlimited
    discount: number       // percentage for TIERED type
}

export type DiscountSchemeInput = {
    id: string
    code: string
    name: string
    type: "PERCENTAGE" | "FIXED" | "TIERED"
    scope: "GLOBAL" | "PRICELIST" | "CUSTOMER" | "PRODUCT" | "CATEGORY"
    value: number | null
    tieredRules: TieredRule[] | null
    isActive: boolean
    validFrom: Date | string | null
    validTo: Date | string | null
    minOrderValue: number | null
    priceListId: string | null
    customerId: string | null
    productId: string | null
    categoryId: string | null
}

export type LineItemInput = {
    productId: string
    categoryId: string | null
    quantity: number
    unitPrice: number
}

export type DiscountResult = {
    schemeId: string
    schemeCode: string
    schemeName: string
    type: "PERCENTAGE" | "FIXED" | "TIERED"
    discountPerUnit: number      // discount amount per unit
    discountPercent: number      // effective percentage
    totalDiscount: number        // total discount for the line
    tierLabel: string | null     // e.g. "100-499 unit → 5%"
}

export type LineDiscountSummary = {
    originalTotal: number
    totalDiscount: number
    finalTotal: number
    appliedDiscounts: DiscountResult[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function isDateValid(scheme: DiscountSchemeInput, now: Date = new Date()): boolean {
    if (scheme.validFrom) {
        const from = new Date(scheme.validFrom)
        if (now < from) return false
    }
    if (scheme.validTo) {
        const to = new Date(scheme.validTo)
        if (now > to) return false
    }
    return true
}

function matchesScope(
    scheme: DiscountSchemeInput,
    context: {
        priceListId?: string | null
        customerId?: string | null
        productId: string
        categoryId: string | null
    }
): boolean {
    switch (scheme.scope) {
        case "GLOBAL":
            return true
        case "PRICELIST":
            return !!scheme.priceListId && scheme.priceListId === context.priceListId
        case "CUSTOMER":
            return !!scheme.customerId && scheme.customerId === context.customerId
        case "PRODUCT":
            return !!scheme.productId && scheme.productId === context.productId
        case "CATEGORY":
            return !!scheme.categoryId && scheme.categoryId === context.categoryId
        default:
            return false
    }
}

function parseTieredRules(raw: unknown): TieredRule[] {
    if (!raw) return []
    if (Array.isArray(raw)) return raw as TieredRule[]
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw)
        } catch {
            return []
        }
    }
    return []
}

// ─── Core Calculator ─────────────────────────────────────────────────────

/**
 * Calculate the discount for a single line item from a single scheme.
 */
export function calculateSchemeDiscount(
    scheme: DiscountSchemeInput,
    lineItem: LineItemInput,
): DiscountResult | null {
    const { quantity, unitPrice } = lineItem
    const lineTotal = quantity * unitPrice

    if (!scheme.isActive) return null
    if (!isDateValid(scheme)) return null
    if (scheme.minOrderValue != null && lineTotal < scheme.minOrderValue) return null

    switch (scheme.type) {
        case "PERCENTAGE": {
            const pct = Number(scheme.value ?? 0)
            if (pct <= 0) return null
            const discountPerUnit = unitPrice * (pct / 100)
            return {
                schemeId: scheme.id,
                schemeCode: scheme.code,
                schemeName: scheme.name,
                type: "PERCENTAGE",
                discountPerUnit: Math.round(discountPerUnit),
                discountPercent: pct,
                totalDiscount: Math.round(discountPerUnit * quantity),
                tierLabel: null,
            }
        }

        case "FIXED": {
            const fixedAmt = Number(scheme.value ?? 0)
            if (fixedAmt <= 0) return null
            const pct = unitPrice > 0 ? (fixedAmt / unitPrice) * 100 : 0
            return {
                schemeId: scheme.id,
                schemeCode: scheme.code,
                schemeName: scheme.name,
                type: "FIXED",
                discountPerUnit: Math.round(fixedAmt),
                discountPercent: Math.round(pct * 100) / 100,
                totalDiscount: Math.round(fixedAmt * quantity),
                tierLabel: null,
            }
        }

        case "TIERED": {
            const rules = parseTieredRules(scheme.tieredRules)
            if (rules.length === 0) return null

            // Find matching tier
            const matchedTier = rules.find(
                (r) => quantity >= r.minQty && (r.maxQty === null || quantity <= r.maxQty)
            )
            if (!matchedTier) return null

            const pct = matchedTier.discount
            const discountPerUnit = unitPrice * (pct / 100)
            const maxLabel = matchedTier.maxQty != null ? matchedTier.maxQty.toLocaleString("id-ID") : "~"
            return {
                schemeId: scheme.id,
                schemeCode: scheme.code,
                schemeName: scheme.name,
                type: "TIERED",
                discountPerUnit: Math.round(discountPerUnit),
                discountPercent: pct,
                totalDiscount: Math.round(discountPerUnit * quantity),
                tierLabel: `${matchedTier.minQty.toLocaleString("id-ID")}-${maxLabel} unit → ${pct}%`,
            }
        }

        default:
            return null
    }
}

/**
 * Find all applicable discounts for a line item, given available schemes.
 * Best discount wins (highest total discount).
 */
export function findApplicableDiscounts(
    schemes: DiscountSchemeInput[],
    lineItem: LineItemInput,
    context: {
        priceListId?: string | null
        customerId?: string | null
    } = {}
): LineDiscountSummary {
    const originalTotal = lineItem.quantity * lineItem.unitPrice

    const applicableResults: DiscountResult[] = []

    for (const scheme of schemes) {
        if (!matchesScope(scheme, {
            ...context,
            productId: lineItem.productId,
            categoryId: lineItem.categoryId,
        })) continue

        const result = calculateSchemeDiscount(scheme, lineItem)
        if (result) applicableResults.push(result)
    }

    // Sort by total discount descending — best discount first
    applicableResults.sort((a, b) => b.totalDiscount - a.totalDiscount)

    // Apply best single discount (non-stackable)
    const bestDiscount = applicableResults[0] ?? null
    const totalDiscount = bestDiscount?.totalDiscount ?? 0

    return {
        originalTotal: Math.round(originalTotal),
        totalDiscount,
        finalTotal: Math.round(originalTotal - totalDiscount),
        appliedDiscounts: bestDiscount ? [bestDiscount] : [],
    }
}

/**
 * Validate tiered rules: no gaps, no overlaps, ascending order.
 */
export function validateTieredRules(rules: TieredRule[]): string[] {
    const errors: string[] = []
    if (rules.length === 0) {
        errors.push("Minimal harus ada 1 tier")
        return errors
    }

    // Sort by minQty
    const sorted = [...rules].sort((a, b) => a.minQty - b.minQty)

    for (let i = 0; i < sorted.length; i++) {
        const rule = sorted[i]
        if (rule.minQty < 0) errors.push(`Tier ${i + 1}: minQty tidak boleh negatif`)
        if (rule.maxQty !== null && rule.maxQty < rule.minQty) {
            errors.push(`Tier ${i + 1}: maxQty harus >= minQty`)
        }
        if (rule.discount <= 0 || rule.discount > 100) {
            errors.push(`Tier ${i + 1}: diskon harus antara 0.01% dan 100%`)
        }

        // Check overlap with next tier
        if (i < sorted.length - 1) {
            const next = sorted[i + 1]
            const currentMax = rule.maxQty ?? Infinity
            if (currentMax >= next.minQty) {
                errors.push(`Tier ${i + 1} dan ${i + 2} saling tumpang tindih`)
            }
        }
    }

    return errors
}
