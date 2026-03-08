import { describe, it, expect } from 'vitest'
import {
  calculateAverageCost,
  addFIFOLayer,
  consumeFIFO,
  calculateFIFOValuation,
  calculateInventoryValuation,
  calculateCOGS,
  type CostLayerInput,
} from '@/lib/costing'

// =============================================================================
// Average Cost (Rata-rata Tertimbang)
// =============================================================================

describe('calculateAverageCost', () => {
  it('calculates weighted average on first receipt', () => {
    // Stok awal 0, terima 100 unit @ Rp 10.000
    const result = calculateAverageCost(0, 0, 100, 10000)
    expect(result.newAverageCost).toBe(10000)
    expect(result.newTotalQty).toBe(100)
    expect(result.newTotalValue).toBe(1000000)
  })

  it('calculates weighted average on subsequent receipt', () => {
    // Stok 100 @ Rp 10.000, terima 50 @ Rp 12.000
    // Total value: 1.000.000 + 600.000 = 1.600.000
    // Total qty: 150
    // Average: 1.600.000 / 150 = 10.666,6667
    const result = calculateAverageCost(100, 10000, 50, 12000)
    expect(result.newAverageCost).toBeCloseTo(10666.6667, 2)
    expect(result.newTotalQty).toBe(150)
    expect(result.newTotalValue).toBe(1600000)
  })

  it('returns current cost when receipt qty is 0', () => {
    const result = calculateAverageCost(100, 10000, 0, 15000)
    expect(result.newAverageCost).toBe(10000)
    expect(result.newTotalQty).toBe(100)
  })

  it('returns current cost when receipt qty is negative', () => {
    const result = calculateAverageCost(100, 10000, -5, 15000)
    expect(result.newAverageCost).toBe(10000)
  })

  it('handles zero current stock', () => {
    const result = calculateAverageCost(0, 0, 200, 5000)
    expect(result.newAverageCost).toBe(5000)
    expect(result.newTotalQty).toBe(200)
  })
})

// =============================================================================
// FIFO Layer Management
// =============================================================================

describe('addFIFOLayer', () => {
  it('adds a new layer to empty list', () => {
    const layers = addFIFOLayer([], { qty: 100, unitCost: 10000 })
    expect(layers).toHaveLength(1)
    expect(layers[0].qty).toBe(100)
    expect(layers[0].unitCost).toBe(10000)
    expect(layers[0].remainingQty).toBe(100)
  })

  it('appends layer to existing layers', () => {
    const existing: CostLayerInput[] = [
      { qty: 100, unitCost: 10000, remainingQty: 50 },
    ]
    const layers = addFIFOLayer(existing, { qty: 200, unitCost: 12000 })
    expect(layers).toHaveLength(2)
    expect(layers[1].unitCost).toBe(12000)
    expect(layers[1].remainingQty).toBe(200)
  })

  it('ignores zero qty receipt', () => {
    const existing: CostLayerInput[] = [
      { qty: 100, unitCost: 10000, remainingQty: 100 },
    ]
    const layers = addFIFOLayer(existing, { qty: 0, unitCost: 15000 })
    expect(layers).toHaveLength(1)
  })
})

// =============================================================================
// FIFO Consumption
// =============================================================================

describe('consumeFIFO', () => {
  it('consumes from oldest layer first', () => {
    const layers: CostLayerInput[] = [
      { qty: 100, unitCost: 10000, remainingQty: 100 },
      { qty: 100, unitCost: 12000, remainingQty: 100 },
    ]

    // Ambil 80 unit → dari layer pertama
    const result = consumeFIFO(layers, 80)
    expect(result.totalCost).toBe(800000) // 80 * 10.000
    expect(result.qtyConsumed).toBe(80)
    expect(result.updatedLayers[0].remainingQty).toBe(20)
    expect(result.updatedLayers[1].remainingQty).toBe(100)
  })

  it('spans multiple layers', () => {
    const layers: CostLayerInput[] = [
      { qty: 100, unitCost: 10000, remainingQty: 50 },
      { qty: 100, unitCost: 12000, remainingQty: 100 },
    ]

    // Ambil 120 unit → 50 dari layer 1 + 70 dari layer 2
    const result = consumeFIFO(layers, 120)
    expect(result.totalCost).toBe(50 * 10000 + 70 * 12000) // 500.000 + 840.000 = 1.340.000
    expect(result.qtyConsumed).toBe(120)
    expect(result.updatedLayers[0].remainingQty).toBe(0)
    expect(result.updatedLayers[1].remainingQty).toBe(30)
  })

  it('handles insufficient stock', () => {
    const layers: CostLayerInput[] = [
      { qty: 50, unitCost: 10000, remainingQty: 30 },
    ]

    // Mau ambil 50 tapi cuma ada 30
    const result = consumeFIFO(layers, 50)
    expect(result.qtyConsumed).toBe(30)
    expect(result.totalCost).toBe(300000) // 30 * 10.000
    expect(result.updatedLayers[0].remainingQty).toBe(0)
  })

  it('returns zero for zero consumption', () => {
    const layers: CostLayerInput[] = [
      { qty: 100, unitCost: 10000, remainingQty: 100 },
    ]

    const result = consumeFIFO(layers, 0)
    expect(result.totalCost).toBe(0)
    expect(result.qtyConsumed).toBe(0)
    expect(result.updatedLayers[0].remainingQty).toBe(100)
  })

  it('skips depleted layers', () => {
    const layers: CostLayerInput[] = [
      { qty: 100, unitCost: 8000, remainingQty: 0 },
      { qty: 100, unitCost: 10000, remainingQty: 100 },
    ]

    const result = consumeFIFO(layers, 50)
    expect(result.totalCost).toBe(500000) // 50 * 10.000
    expect(result.updatedLayers[0].remainingQty).toBe(0)
    expect(result.updatedLayers[1].remainingQty).toBe(50)
  })
})

// =============================================================================
// FIFO Valuation
// =============================================================================

describe('calculateFIFOValuation', () => {
  it('sums remaining qty * unitCost across layers', () => {
    const layers: CostLayerInput[] = [
      { qty: 100, unitCost: 10000, remainingQty: 30 },
      { qty: 200, unitCost: 12000, remainingQty: 200 },
    ]

    const result = calculateFIFOValuation(layers)
    expect(result.totalQty).toBe(230)
    expect(result.totalValue).toBe(30 * 10000 + 200 * 12000) // 300.000 + 2.400.000 = 2.700.000
    expect(result.unitCost).toBeCloseTo(2700000 / 230, 2)
  })

  it('returns 0 for empty layers', () => {
    const result = calculateFIFOValuation([])
    expect(result.totalQty).toBe(0)
    expect(result.totalValue).toBe(0)
    expect(result.unitCost).toBe(0)
  })

  it('ignores depleted layers', () => {
    const layers: CostLayerInput[] = [
      { qty: 100, unitCost: 8000, remainingQty: 0 },
      { qty: 50, unitCost: 15000, remainingQty: 50 },
    ]

    const result = calculateFIFOValuation(layers)
    expect(result.totalQty).toBe(50)
    expect(result.totalValue).toBe(750000)
  })
})

// =============================================================================
// Unified Valuation
// =============================================================================

describe('calculateInventoryValuation', () => {
  it('uses average method', () => {
    const result = calculateInventoryValuation('AVERAGE', 100, 10000, [])
    expect(result.totalQty).toBe(100)
    expect(result.totalValue).toBe(1000000)
    expect(result.unitCost).toBe(10000)
  })

  it('uses FIFO method', () => {
    const layers: CostLayerInput[] = [
      { qty: 100, unitCost: 10000, remainingQty: 100 },
      { qty: 50, unitCost: 12000, remainingQty: 50 },
    ]

    const result = calculateInventoryValuation('FIFO', 0, 0, layers)
    expect(result.totalQty).toBe(150)
    expect(result.totalValue).toBe(1600000)
  })
})

// =============================================================================
// COGS Calculation
// =============================================================================

describe('calculateCOGS', () => {
  it('calculates COGS with average method', () => {
    const result = calculateCOGS('AVERAGE', 50, 10000, [])
    expect(result.totalCost).toBe(500000)
    expect(result.qtyConsumed).toBe(50)
  })

  it('calculates COGS with FIFO method', () => {
    const layers: CostLayerInput[] = [
      { qty: 100, unitCost: 10000, remainingQty: 100 },
      { qty: 100, unitCost: 14000, remainingQty: 100 },
    ]

    // Ambil 120: 100 * 10.000 + 20 * 14.000 = 1.000.000 + 280.000 = 1.280.000
    const result = calculateCOGS('FIFO', 120, 0, layers)
    expect(result.totalCost).toBe(1280000)
    expect(result.qtyConsumed).toBe(120)
    expect(result.updatedLayers[0].remainingQty).toBe(0)
    expect(result.updatedLayers[1].remainingQty).toBe(80)
  })
})
