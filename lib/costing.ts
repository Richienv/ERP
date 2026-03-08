/**
 * Costing Method Logic — Average & FIFO
 *
 * Digunakan untuk menghitung biaya persediaan (inventory valuation),
 * HPP (COGS), dan laporan laba-rugi.
 *
 * Kebanyakan UKM tekstil Indonesia pakai metode rata-rata (AVERAGE).
 * FIFO dipakai jika harga bahan baku fluktuatif.
 */

// =============================================================================
// Types
// =============================================================================

export type CostingMethod = "AVERAGE" | "FIFO"

export interface CostLayerInput {
  qty: number
  unitCost: number
  remainingQty: number
  createdAt?: Date
}

export interface ReceiptInput {
  qty: number
  unitCost: number
}

export interface ConsumptionResult {
  totalCost: number
  qtyConsumed: number
  /** Updated layers after consumption (FIFO only) */
  updatedLayers: CostLayerInput[]
}

export interface AverageCostResult {
  newAverageCost: number
  newTotalQty: number
  newTotalValue: number
}

export interface InventoryValuation {
  productId: string
  method: CostingMethod
  totalQty: number
  totalValue: number
  unitCost: number
}

// =============================================================================
// Average Cost (Rata-rata Tertimbang)
// =============================================================================

/**
 * Hitung biaya rata-rata tertimbang setelah penerimaan barang baru.
 *
 * Formula: (existing_value + new_value) / (existing_qty + new_qty)
 *
 * @param currentQty   - Stok saat ini
 * @param currentCost  - Biaya rata-rata saat ini per unit
 * @param receiptQty   - Jumlah barang masuk
 * @param receiptCost  - Biaya per unit barang masuk
 */
export function calculateAverageCost(
  currentQty: number,
  currentCost: number,
  receiptQty: number,
  receiptCost: number
): AverageCostResult {
  if (receiptQty <= 0) {
    return {
      newAverageCost: currentCost,
      newTotalQty: currentQty,
      newTotalValue: currentQty * currentCost,
    }
  }

  const existingValue = currentQty * currentCost
  const newValue = receiptQty * receiptCost
  const newTotalQty = currentQty + receiptQty
  const newTotalValue = existingValue + newValue

  const newAverageCost = newTotalQty > 0
    ? Math.round((newTotalValue / newTotalQty) * 10000) / 10000
    : 0

  return {
    newAverageCost,
    newTotalQty,
    newTotalValue,
  }
}

// =============================================================================
// FIFO (First In First Out)
// =============================================================================

/**
 * Tambah layer baru saat penerimaan barang (PO receive, production in).
 */
export function addFIFOLayer(
  existingLayers: CostLayerInput[],
  receipt: ReceiptInput
): CostLayerInput[] {
  if (receipt.qty <= 0) return existingLayers

  return [
    ...existingLayers,
    {
      qty: receipt.qty,
      unitCost: receipt.unitCost,
      remainingQty: receipt.qty,
      createdAt: new Date(),
    },
  ]
}

/**
 * Konsumsi stok menggunakan metode FIFO — layer paling lama dipakai duluan.
 *
 * @param layers    - Daftar cost layer yang tersisa (sorted by createdAt ASC)
 * @param qtyNeeded - Jumlah yang dibutuhkan
 * @returns Hasil konsumsi: total biaya, jumlah terkonsumsi, dan layer yang diperbarui
 */
export function consumeFIFO(
  layers: CostLayerInput[],
  qtyNeeded: number
): ConsumptionResult {
  if (qtyNeeded <= 0) {
    return { totalCost: 0, qtyConsumed: 0, updatedLayers: [...layers] }
  }

  let remaining = qtyNeeded
  let totalCost = 0
  const updatedLayers: CostLayerInput[] = []

  for (const layer of layers) {
    if (remaining <= 0) {
      updatedLayers.push({ ...layer })
      continue
    }

    const available = layer.remainingQty
    if (available <= 0) {
      // Layer sudah habis, skip
      updatedLayers.push({ ...layer })
      continue
    }

    const take = Math.min(available, remaining)
    totalCost += take * layer.unitCost
    remaining -= take

    updatedLayers.push({
      ...layer,
      remainingQty: available - take,
    })
  }

  return {
    totalCost: Math.round(totalCost * 10000) / 10000,
    qtyConsumed: qtyNeeded - remaining,
    updatedLayers,
  }
}

/**
 * Hitung valuasi FIFO: total nilai persediaan = SUM(remainingQty * unitCost) per layer.
 */
export function calculateFIFOValuation(layers: CostLayerInput[]): {
  totalQty: number
  totalValue: number
  unitCost: number
} {
  let totalQty = 0
  let totalValue = 0

  for (const layer of layers) {
    if (layer.remainingQty > 0) {
      totalQty += layer.remainingQty
      totalValue += layer.remainingQty * layer.unitCost
    }
  }

  const unitCost = totalQty > 0
    ? Math.round((totalValue / totalQty) * 10000) / 10000
    : 0

  return { totalQty, totalValue, unitCost }
}

// =============================================================================
// Unified Valuation
// =============================================================================

/**
 * Hitung valuasi persediaan berdasarkan metode costing yang dipilih.
 *
 * @param method      - AVERAGE atau FIFO
 * @param currentQty  - Stok saat ini (untuk AVERAGE)
 * @param currentCost - Biaya rata-rata saat ini (untuk AVERAGE)
 * @param layers      - Cost layers (untuk FIFO)
 */
export function calculateInventoryValuation(
  method: CostingMethod,
  currentQty: number,
  currentCost: number,
  layers: CostLayerInput[]
): { totalQty: number; totalValue: number; unitCost: number } {
  if (method === "FIFO") {
    return calculateFIFOValuation(layers)
  }

  // AVERAGE
  const totalValue = currentQty * currentCost
  return {
    totalQty: currentQty,
    totalValue,
    unitCost: currentCost,
  }
}

/**
 * Hitung COGS (HPP) untuk sejumlah barang keluar.
 *
 * @param method      - AVERAGE atau FIFO
 * @param qty         - Jumlah barang keluar
 * @param currentCost - Biaya rata-rata saat ini (untuk AVERAGE)
 * @param layers      - Cost layers (untuk FIFO)
 */
export function calculateCOGS(
  method: CostingMethod,
  qty: number,
  currentCost: number,
  layers: CostLayerInput[]
): ConsumptionResult {
  if (method === "FIFO") {
    return consumeFIFO(layers, qty)
  }

  // AVERAGE: COGS = qty * average cost
  const totalCost = Math.round(qty * currentCost * 10000) / 10000
  return {
    totalCost,
    qtyConsumed: qty,
    updatedLayers: layers,
  }
}
