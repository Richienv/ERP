import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { type StockStatus, type ProductStockInfo } from "@/lib/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Inventory-specific utility functions

/**
 * Format currency for Indonesian Rupiah
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

/**
 * Format number with Indonesian locale
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('id-ID').format(num)
}

/**
 * Determine stock status based on current stock levels
 */
export function getStockStatus(currentStock: number, minStock: number, maxStock: number): StockStatus {
  if (currentStock === 0) return 'out'
  if (currentStock <= minStock * 0.5) return 'critical'
  if (currentStock <= minStock) return 'low'
  return 'normal'
}

/**
 * Get stock status information
 */
export function getStockInfo(currentStock: number, minStock: number, maxStock: number): ProductStockInfo {
  return {
    currentStock,
    minStock,
    maxStock,
    status: getStockStatus(currentStock, minStock, maxStock)
  }
}

/**
 * Generate product code with Indonesian format
 */
export function generateProductCode(category: string, sequence: number): string {
  const categoryCode = category.substring(0, 3).toUpperCase()
  const seqString = sequence.toString().padStart(3, '0')
  return `${categoryCode}${seqString}`
}

/**
 * Calculate stock value
 */
export function calculateStockValue(quantity: number, unitPrice: number): number {
  return quantity * unitPrice
}

/**
 * Get percentage of stock usage
 */
export function getStockPercentage(current: number, max: number): number {
  if (max === 0) return 0
  return Math.round((current / max) * 100)
}

/**
 * Check if stock needs reorder
 */
export function needsReorder(currentStock: number, reorderLevel: number): boolean {
  return currentStock <= reorderLevel
}

/**
 * Format Indonesian date
 */
export function formatIndonesianDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(dateObj)
}

/**
 * Format Indonesian date with time
 */
export function formatIndonesianDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj)
}

/**
 * Get relative time in Indonesian
 */
export function getRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInMs = now.getTime() - dateObj.getTime()
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInHours < 1) return 'Baru saja'
  if (diffInHours < 24) return `${diffInHours} jam lalu`
  if (diffInDays === 1) return 'Kemarin'
  if (diffInDays < 7) return `${diffInDays} hari lalu`
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} minggu lalu`
  return formatIndonesianDate(dateObj)
}

/**
 * Validate product code format (legacy simple: ABC001)
 */
export function isValidProductCode(code: string): boolean {
  const regex = /^[A-Z]{3}\d{3}$/
  return regex.test(code)
}

/**
 * Validate structured textile code: MFG-TSH-BR-BLK-001
 */
export function isValidStructuredCode(code: string): boolean {
  return /^[A-Z]{3}-[A-Z]{3}-[A-Z]{2}-[A-Z]{3}-\d{3,4}$/.test(code)
}

// =====================================================================
// TEXTILE PRODUCT CODE — Segment Master Data
// Format: [Category 3]-[Type 3]-[Brand 2]-[Color 3]-[Seq 3-4]
// e.g. MFG-TSH-BR-BLK-001
// =====================================================================

export type CodeSegment = { code: string; label: string; desc?: string }

/** Segment 1 — Category (workflow enforcer) */
export const CODE_CATEGORIES: CodeSegment[] = [
  { code: 'MFG', label: 'Manufactured', desc: 'Produksi via BOM + Work Order' },
  { code: 'TRD', label: 'Trading', desc: 'Beli dari vendor, jual langsung (PR→PO→GRN)' },
  { code: 'RAW', label: 'Raw Material', desc: 'Bahan baku input manufaktur' },
  { code: 'WIP', label: 'Work In Process', desc: 'Intermediate: greige, dyed, printed' },
]

/** Map 3-char category code → Prisma ProductType enum */
export const CATEGORY_TO_PRODUCT_TYPE: Record<string, string> = {
  MFG: 'MANUFACTURED',
  TRD: 'TRADING',
  RAW: 'RAW_MATERIAL',
  WIP: 'WIP',
}

/** Segment 2 — Product Type (material/item classification) */
export const CODE_PRODUCT_TYPES: Record<string, CodeSegment[]> = {
  RAW: [
    { code: 'YRN', label: 'Yarn', desc: 'Benang' },
    { code: 'FAB', label: 'Fabric', desc: 'Kain mentah' },
    { code: 'TRM', label: 'Trim', desc: 'Aksesori (kancing, resleting, label)' },
    { code: 'CHM', label: 'Chemical', desc: 'Zat kimia (pewarna, softener)' },
    { code: 'PKG', label: 'Packaging', desc: 'Material kemasan' },
  ],
  WIP: [
    { code: 'GRY', label: 'Greige', desc: 'Kain greige (belum finishing)' },
    { code: 'DYD', label: 'Dyed', desc: 'Kain sudah dicelup' },
    { code: 'PRT', label: 'Printed', desc: 'Kain sudah dicetak' },
    { code: 'CUT', label: 'Cut Parts', desc: 'Potongan siap jahit' },
  ],
  MFG: [
    { code: 'TSH', label: 'T-Shirt', desc: 'Kaos' },
    { code: 'PNT', label: 'Pants', desc: 'Celana' },
    { code: 'JKT', label: 'Jacket', desc: 'Jaket' },
    { code: 'SCR', label: 'Scarf', desc: 'Syal / Scarf' },
    { code: 'DRS', label: 'Dress', desc: 'Gaun' },
    { code: 'SKT', label: 'Skirt', desc: 'Rok' },
    { code: 'HDW', label: 'Headwear', desc: 'Topi / Headwear' },
    { code: 'BAG', label: 'Bag', desc: 'Tas' },
    { code: 'OTR', label: 'Other', desc: 'Produk lain' },
  ],
  TRD: [
    { code: 'TSH', label: 'T-Shirt', desc: 'Kaos (beli jadi)' },
    { code: 'PNT', label: 'Pants', desc: 'Celana (beli jadi)' },
    { code: 'JKT', label: 'Jacket', desc: 'Jaket (beli jadi)' },
    { code: 'ACC', label: 'Accessory', desc: 'Aksesori (beli jadi)' },
    { code: 'FAB', label: 'Fabric', desc: 'Kain (beli jadi, jual langsung)' },
    { code: 'OTR', label: 'Other', desc: 'Produk lain' },
  ],
}

/** Segment 3 — Brand */
export const CODE_BRANDS: CodeSegment[] = [
  { code: 'BR', label: 'Brand BR' },
  { code: 'ZR', label: 'Brand ZR' },
  { code: 'EL', label: 'Brand EL' },
  { code: 'LV', label: 'Brand LV' },
  { code: 'GN', label: 'Generic' },
  { code: 'XX', label: 'Unbranded' },
]

/** Segment 4 — Color */
export const CODE_COLORS: CodeSegment[] = [
  { code: 'BLK', label: 'Black' },
  { code: 'WHT', label: 'White' },
  { code: 'IND', label: 'Indigo' },
  { code: 'CML', label: 'Camel' },
  { code: 'MRN', label: 'Maroon' },
  { code: 'CHR', label: 'Charcoal' },
  { code: 'NVY', label: 'Navy' },
  { code: 'OLV', label: 'Olive' },
  { code: 'TEL', label: 'Teal' },
  { code: 'GLD', label: 'Gold' },
  { code: 'RED', label: 'Red' },
  { code: 'BLU', label: 'Blue' },
  { code: 'GRN', label: 'Green' },
  { code: 'GRY', label: 'Grey' },
  { code: 'BEG', label: 'Beige' },
  { code: 'CRM', label: 'Cream' },
  { code: 'PNK', label: 'Pink' },
  { code: 'MIX', label: 'Multi / Mix' },
  { code: 'NAT', label: 'Natural' },
]

/** Build structured code from segments */
export function buildStructuredCode(category: string, type: string, brand: string, color: string, seq: number): string {
  return `${category}-${type}-${brand}-${color}-${seq.toString().padStart(3, '0')}`
}

/**
 * Generate internal barcode from product code: ERP-{CODE}-{CHECK}
 */
export function generateBarcode(productCode: string): string {
  const sum = productCode.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const check = (sum % 97).toString().padStart(2, '0')
  return `ERP-${productCode}-${check}`
}

/**
 * Calculate margin percentage
 */
export function calculateMargin(costPrice: number, sellingPrice: number): number {
  if (costPrice === 0) return 0
  return Math.round(((sellingPrice - costPrice) / costPrice) * 100)
}

/**
 * Get stock status color classes
 */
export function getStockStatusColor(status: StockStatus): string {
  switch (status) {
    case 'out':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'low':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'normal':
      return 'text-green-600 bg-green-50 border-green-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

/**
 * Get stock status text in Indonesian
 */
export function getStockStatusText(status: StockStatus): string {
  switch (status) {
    case 'out':
      return 'Habis Stok'
    case 'critical':
      return 'Kritis'
    case 'low':
      return 'Menipis'
    case 'normal':
      return 'Normal'
    default:
      return 'Tidak Diketahui'
  }
}

/**
 * Indonesian provinces list
 */
export const INDONESIAN_PROVINCES = [
  'Aceh',
  'Sumatera Utara',
  'Sumatera Barat', 
  'Riau',
  'Kepulauan Riau',
  'Jambi',
  'Sumatera Selatan',
  'Kepulauan Bangka Belitung',
  'Bengkulu',
  'Lampung',
  'DKI Jakarta',
  'Jawa Barat',
  'Jawa Tengah',
  'DI Yogyakarta',
  'Jawa Timur',
  'Banten',
  'Bali',
  'Nusa Tenggara Barat',
  'Nusa Tenggara Timur',
  'Kalimantan Barat',
  'Kalimantan Tengah',
  'Kalimantan Selatan',
  'Kalimantan Timur',
  'Kalimantan Utara',
  'Sulawesi Utara',
  'Sulawesi Tengah',
  'Sulawesi Selatan',
  'Sulawesi Tenggara',
  'Gorontalo',
  'Sulawesi Barat',
  'Maluku',
  'Maluku Utara',
  'Papua',
  'Papua Barat',
  'Papua Selatan',
  'Papua Tengah',
  'Papua Pegunungan'
]

/**
 * Common Indonesian units for products
 */
export const INDONESIAN_UNITS = [
  'pcs', // pieces
  'set',
  'unit',
  'kg', // kilogram
  'gram',
  'ton',
  'liter',
  'ml', // mililiter
  'm', // meter
  'cm', // centimeter
  'yard', // yard
  'm²', // meter persegi
  'm³', // meter kubik
  'rim',
  'pack',
  'box',
  'karton',
  'botol',
  'kaleng',
  'sachet',
  'roll'
]