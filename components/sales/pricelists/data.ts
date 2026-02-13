// Types for PriceList UI components — derived from server action responses

export interface PriceListSummary {
    id: string
    code: string
    name: string
    description: string | null
    currency: string
    isActive: boolean
    itemCount: number
    customerCount: number
    previewItems: {
        productName: string
        productCode: string
        price: number
        unit: string
    }[]
    createdAt: string
    updatedAt: string
}

export interface PriceListDetail {
    id: string
    code: string
    name: string
    description: string | null
    currency: string
    isActive: boolean
    itemCount: number
    customerCount: number
    items: PriceListItemDetail[]
    customers: { id: string; name: string; code: string }[]
    createdAt: string
    updatedAt: string
}

export interface PriceListItemDetail {
    id: string
    productId: string
    productCode: string
    productName: string
    productDescription: string | null
    category: string
    unit: string
    basePrice: number
    listPrice: number
    minQty: number
    validFrom: string | null
    validTo: string | null
}

export interface ProductOption {
    id: string
    code: string
    name: string
    unit: string
    sellingPrice: number
    category: string
}

// Color palette for card accents — cycles based on index
export const CATALOG_COLORS = [
    { bg: "bg-violet-600", text: "text-violet-600", light: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800" },
    { bg: "bg-blue-600", text: "text-blue-600", light: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800" },
    { bg: "bg-emerald-600", text: "text-emerald-600", light: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800" },
    { bg: "bg-amber-600", text: "text-amber-600", light: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800" },
    { bg: "bg-rose-600", text: "text-rose-600", light: "bg-rose-50 dark:bg-rose-950/30", border: "border-rose-200 dark:border-rose-800" },
    { bg: "bg-cyan-600", text: "text-cyan-600", light: "bg-cyan-50 dark:bg-cyan-950/30", border: "border-cyan-200 dark:border-cyan-800" },
] as const

export function getColorByIndex(index: number) {
    return CATALOG_COLORS[index % CATALOG_COLORS.length]
}

export function formatRupiah(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}
