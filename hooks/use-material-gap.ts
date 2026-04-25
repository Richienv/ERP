"use client"

import { useQuery } from "@tanstack/react-query"

export type MaterialGapStatus =
    | "ALERT"
    | "REQUESTED"
    | "APPROVED"
    | "COMPLETED"
    | "HEALTHY"
    | "REJECTED"

export type MaterialGapFilterStatus = "ALL" | MaterialGapStatus

export type MaterialGapRow = {
    sku: string
    name: string
    grade: "A" | "B" | "C"
    unit: string
    stock: number
    demand: number
    safety: number
    rop: number
    leadHours: number
    burnPerHour: number
    /** null = stockout */
    coverageHours: number | null
    vendor: { name: string; poRef?: string; status?: string }
    unitPriceIdr: number
    budgetNeededIdr: number
    deficitQty?: number
    status: MaterialGapStatus
}

export type MaterialGapWarehouse = {
    code: string
    name: string
    skuCount: number
    valueIdrJt: number
    utilPct: number
    status: "NORMAL" | "RAMAI" | "PENUH" | "IDLE"
}

export type MaterialGapData = {
    kpis: {
        totalInventoryIdr: number
        lowStockCount: number
        opnameAccuracyPct: number
        inboundToday: number
        outboundToday: number
        gapBudgetIdr: number
        gapItemCount: number
    }
    filters: { query?: string; status?: MaterialGapFilterStatus }
    rows: MaterialGapRow[]
    warehouses: MaterialGapWarehouse[]
    procurement: {
        restockNeededIdr: number
        restockItemCount: number
        incomingPoCount: number
        incomingVendorNote: string
        pendingApproval: { count: number; totalIdr: number }
        onTimeDeliveryPct: number
    }
}

const mockData: MaterialGapData = {
    kpis: {
        totalInventoryIdr: 18_247_000_000,
        lowStockCount: 26,
        opnameAccuracyPct: 97.2,
        inboundToday: 42,
        outboundToday: 38,
        gapBudgetIdr: -284_000_000,
        gapItemCount: 12,
    },
    filters: { status: "ALL" },
    rows: [
        {
            sku: "SKU-00088",
            name: "Kabel Shielded 4×0,75mm",
            grade: "B",
            unit: "meter",
            stock: 142,
            demand: 800,
            safety: 300,
            rop: 500,
            leadHours: 72,
            burnPerHour: 12,
            coverageHours: 6.2,
            vendor: { name: "Kencana Wire", poRef: "PR-0414" },
            unitPriceIdr: 18_500,
            budgetNeededIdr: 12_175_000,
            deficitQty: 658,
            status: "ALERT",
        },
        {
            sku: "SKU-03301",
            name: "Sekrup M4×16 Stainless",
            grade: "C",
            unit: "pc",
            stock: 840,
            demand: 3000,
            safety: 1500,
            rop: 2000,
            leadHours: 48,
            burnPerHour: 60,
            coverageHours: 8.1,
            vendor: { name: "Mulia Fastener" },
            unitPriceIdr: 850,
            budgetNeededIdr: 1_836_000,
            deficitQty: 2160,
            status: "REQUESTED",
        },
        {
            sku: "MTR-0184",
            name: "Motor Servo 24V · 180W",
            grade: "A",
            unit: "unit",
            stock: 12,
            demand: 80,
            safety: 80,
            rop: 100,
            leadHours: 168,
            burnPerHour: 2.5,
            coverageHours: 2.4,
            vendor: { name: "Surya Metal", poRef: "PO-0871" },
            unitPriceIdr: 4_280_000,
            budgetNeededIdr: 290_240_000,
            deficitQty: 68,
            status: "ALERT",
        },
        {
            sku: "BRG-1042",
            name: "Bearing 6204-2Z",
            grade: "B",
            unit: "pc",
            stock: 48,
            demand: 240,
            safety: 200,
            rop: 280,
            leadHours: 120,
            burnPerHour: 8,
            coverageHours: 3.1,
            vendor: { name: "Nusantara" },
            unitPriceIdr: 142_800,
            budgetNeededIdr: 27_408_000,
            deficitQty: 192,
            status: "APPROVED",
        },
        {
            sku: "PCB-0218",
            name: "PCB Kontroler v2.1",
            grade: "A",
            unit: "unit",
            stock: 24,
            demand: 120,
            safety: 120,
            rop: 160,
            leadHours: 336,
            burnPerHour: 1.8,
            coverageHours: 4.8,
            vendor: { name: "Elektra Indo" },
            unitPriceIdr: 218_400,
            budgetNeededIdr: 20_972_800,
            deficitQty: 96,
            status: "REQUESTED",
        },
        {
            sku: "CBL-0088",
            name: "Kabel Shielded 4×0,75mm (red)",
            grade: "C",
            unit: "meter",
            stock: 0,
            demand: 500,
            safety: 300,
            rop: 400,
            leadHours: 72,
            burnPerHour: 14,
            coverageHours: null,
            vendor: { name: "Kencana" },
            unitPriceIdr: 18_500,
            budgetNeededIdr: 9_250_000,
            deficitQty: 500,
            status: "ALERT",
        },
        {
            sku: "HSG-0044",
            name: "Housing Aluminium 120×80",
            grade: "B",
            unit: "unit",
            stock: 214,
            demand: 600,
            safety: 400,
            rop: 500,
            leadHours: 144,
            burnPerHour: 5,
            coverageHours: 42.8,
            vendor: { name: "Alumindo" },
            unitPriceIdr: 94_500,
            budgetNeededIdr: 36_477_000,
            status: "COMPLETED",
        },
        {
            sku: "PLC-0231",
            name: "PLC Compact · 16 I/O",
            grade: "A",
            unit: "unit",
            stock: 92,
            demand: 80,
            safety: 60,
            rop: 100,
            leadHours: 240,
            burnPerHour: 1.2,
            coverageHours: 76.6,
            vendor: { name: "OmronJI" },
            unitPriceIdr: 8_400_000,
            budgetNeededIdr: 0,
            status: "HEALTHY",
        },
    ],
    warehouses: [
        { code: "BDG-01", name: "Gudang Pusat Bandung", skuCount: 412, valueIdrJt: 14_280, utilPct: 87, status: "RAMAI" },
        { code: "JKT-02", name: "Gudang Jakarta Utara", skuCount: 156, valueIdrJt: 2_400, utilPct: 94, status: "PENUH" },
        { code: "JKT-01", name: "Gudang Jakarta Selatan", skuCount: 98, valueIdrJt: 920, utilPct: 62, status: "NORMAL" },
        { code: "SBY-01", name: "Gudang Surabaya", skuCount: 86, valueIdrJt: 547, utilPct: 41, status: "NORMAL" },
        { code: "MKS-01", name: "Gudang Makassar", skuCount: 0, valueIdrJt: 0, utilPct: 0, status: "IDLE" },
    ],
    procurement: {
        restockNeededIdr: 408_500_000,
        restockItemCount: 12,
        incomingPoCount: 42,
        incomingVendorNote: "Surya Metal · ETA 28 Apr",
        pendingApproval: { count: 8, totalIdr: 124_700_000 },
        onTimeDeliveryPct: 92.4,
    },
}

export function useMaterialGap() {
    return useQuery<MaterialGapData>({
        queryKey: ["materialGap", "list"],
        queryFn: async () => {
            // TODO: replace with real fetch("/api/inventory/material-gap") once backend ready.
            return mockData
        },
        staleTime: 60_000,
    })
}
