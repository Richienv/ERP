"use client"

import { useState, useMemo } from "react"
import { ClipboardCheck, Printer } from "lucide-react"
import { formatIDR } from "@/lib/utils"
import { CreateGRNDialog } from "@/components/procurement/create-grn-dialog"
import { GRNDetailsSheet } from "@/components/procurement/grn-details-sheet"
import {
    ModulePageLayout,
    ModulePageHeader,
    SummaryCards,
    SearchFilterBar,
    DataTableShell,
    ShellTableStyles,
    StatusBadge,
    ActionButtonGroup,
} from "@/components/module"
import type { SummaryCard, ActionButton } from "@/components/module"

// ── Types ──

interface POItem {
    id: string
    productId: string
    productName: string
    productCode: string
    unit: string
    orderedQty: number
    receivedQty: number
    remainingQty: number
    unitPrice: number
}

interface PendingPO {
    id: string
    number: string
    vendorName: string
    vendorId: string
    orderDate: Date
    expectedDate: Date | null
    status: string
    totalAmount: number
    items: POItem[]
    hasRemainingItems: boolean
}

interface GRNItem {
    id: string
    productName: string
    productCode: string
    quantityOrdered: number
    quantityReceived: number
    quantityAccepted: number
    quantityRejected: number
    unitCost: number
    inspectionNotes: string | null
}

interface GRN {
    id: string
    number: string
    poNumber: string
    vendorName: string
    warehouseName: string
    receivedBy: string
    receivedDate: Date
    status: string
    notes: string | null
    itemCount: number
    totalAccepted: number
    totalRejected: number
    items: GRNItem[]
}

interface Warehouse {
    id: string
    name: string
    code: string
}

interface Employee {
    id: string
    name: string
    department: string
}

interface ReceivingViewProps {
    pendingPOs: PendingPO[]
    grns: GRN[]
    warehouses: Warehouse[]
    employees: Employee[]
}

// ── Component ──

export function ReceivingView({ pendingPOs, grns, warehouses, employees }: ReceivingViewProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null)
    const [activeTab, setActiveTab] = useState<"pending" | "grns">("pending")

    const filteredPOs = useMemo(() =>
        pendingPOs.filter(po =>
            po.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            po.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
        ), [pendingPOs, searchTerm])

    const filteredGRNs = useMemo(() =>
        grns.filter(grn =>
            grn.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            grn.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            grn.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
        ), [grns, searchTerm])

    const draftCount = grns.filter(g => g.status === "DRAFT").length
    const acceptedGRNs = grns.filter(g => g.status === "ACCEPTED")

    // ── KPI cards ──
    const kpiCards: SummaryCard[] = [
        { label: "PO Menunggu", value: pendingPOs.length, color: "blue", subValue: "siap terima" },
        { label: "SJ Masuk Draft", value: draftCount, color: "orange", subValue: "verifikasi" },
        { label: "Diterima", value: acceptedGRNs.length, color: "green", subValue: "SJ diterima" },
        { label: "Item Diterima", value: acceptedGRNs.reduce((s, g) => s + g.totalAccepted, 0), subValue: "unit bulan ini" },
    ]

    return (
        <div className="mf-page">
            <ModulePageLayout
                header={
                    <ModulePageHeader
                        icon={<ClipboardCheck className="h-5 w-5 text-white" />}
                        title="Surat Jalan Masuk"
                        subtitle="Terima dan verifikasi barang masuk dari supplier"
                        tabs={[
                            { label: `PO Menunggu (${filteredPOs.length})`, value: "pending" },
                            { label: `Riwayat SJ (${filteredGRNs.length})`, value: "grns" },
                        ]}
                        activeTab={activeTab}
                        onTabChange={(v) => setActiveTab(v as "pending" | "grns")}
                    />
                }
                summaryCards={<SummaryCards cards={kpiCards} columns={4} />}
                searchBar={
                    <SearchFilterBar
                        searchPlaceholder="Cari No. PO, SJ Masuk, atau Vendor..."
                        searchValue={searchTerm}
                        onSearchChange={setSearchTerm}
                        resultCount={activeTab === "pending"
                            ? `${filteredPOs.length} PO`
                            : `${filteredGRNs.length} surat jalan`}
                    />
                }
            >
                {/* ── Pending POs Table ── */}
                {activeTab === "pending" && (
                    <DataTableShell
                        title="PO MENUNGGU PENERIMAAN"
                        titleCount={filteredPOs.length}
                        isEmpty={filteredPOs.length === 0}
                        emptyState={{ message: "TIDAK ADA PO YANG MENUNGGU PENERIMAAN" }}
                    >
                        <table className="w-full text-sm">
                            <thead className={ShellTableStyles.thead}>
                                <tr>
                                    <th className={ShellTableStyles.th}>PO Number</th>
                                    <th className={ShellTableStyles.th}>Vendor</th>
                                    <th className={ShellTableStyles.th}>Tanggal</th>
                                    <th className={ShellTableStyles.th + " text-center"}>Status</th>
                                    <th className={ShellTableStyles.th + " text-center"}>Items</th>
                                    <th className={ShellTableStyles.th + " text-right"}>Total</th>
                                    <th className={ShellTableStyles.th + " text-right"}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPOs.map(po => (
                                    <tr key={po.id} className={ShellTableStyles.tr}>
                                        <td className={ShellTableStyles.td + " font-mono font-bold text-blue-600"}>{po.number}</td>
                                        <td className={ShellTableStyles.td + " font-bold"}>{po.vendorName}</td>
                                        <td className={ShellTableStyles.td + " text-zinc-500 font-medium"}>
                                            {new Date(po.orderDate).toLocaleDateString("id-ID")}
                                        </td>
                                        <td className={ShellTableStyles.td + " text-center"}>
                                            <StatusBadge status={po.status} />
                                        </td>
                                        <td className={ShellTableStyles.td + " text-center"}>
                                            <span className="font-black">{po.items.filter(i => i.remainingQty > 0).length}</span>
                                            <span className="text-zinc-400 text-[10px]"> / {po.items.length}</span>
                                        </td>
                                        <td className={ShellTableStyles.td + " text-right font-mono font-bold"}>{formatIDR(po.totalAmount)}</td>
                                        <td className={ShellTableStyles.td + " text-right"}>
                                            <CreateGRNDialog
                                                purchaseOrder={po}
                                                warehouses={warehouses}
                                                employees={employees}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </DataTableShell>
                )}

                {/* ── GRN History Table ── */}
                {activeTab === "grns" && (
                    <DataTableShell
                        title="RIWAYAT SURAT JALAN MASUK"
                        titleCount={filteredGRNs.length}
                        isEmpty={filteredGRNs.length === 0}
                        emptyState={{ message: "BELUM ADA RIWAYAT PENERIMAAN BARANG" }}
                    >
                        <table className="w-full text-sm">
                            <thead className={ShellTableStyles.thead}>
                                <tr>
                                    <th className={ShellTableStyles.th}>No. Surat Jalan</th>
                                    <th className={ShellTableStyles.th}>PO</th>
                                    <th className={ShellTableStyles.th}>Vendor</th>
                                    <th className={ShellTableStyles.th}>Gudang</th>
                                    <th className={ShellTableStyles.th}>Tanggal</th>
                                    <th className={ShellTableStyles.th + " text-center"}>Status</th>
                                    <th className={ShellTableStyles.th + " text-center"}>Diterima</th>
                                    <th className={ShellTableStyles.th + " text-right"}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGRNs.map(grn => {
                                    const actions: ActionButton[] = [
                                        { icon: "view", onClick: () => setSelectedGRN(grn), tooltip: "Detail" },
                                    ]
                                    if (grn.status === "ACCEPTED") {
                                        actions.push({
                                            icon: "print",
                                            onClick: () => window.open(`/api/documents/surat-jalan-masuk/${grn.id}?disposition=inline`, "_blank"),
                                            tooltip: "Cetak SJ",
                                        })
                                    }

                                    return (
                                        <tr
                                            key={grn.id}
                                            className={ShellTableStyles.tr + " cursor-pointer"}
                                            onClick={() => setSelectedGRN(grn)}
                                        >
                                            <td className={ShellTableStyles.td + " font-mono font-bold text-emerald-600"}>{grn.number}</td>
                                            <td className={ShellTableStyles.td + " font-mono text-xs text-blue-600"}>{grn.poNumber}</td>
                                            <td className={ShellTableStyles.td + " font-bold"}>{grn.vendorName}</td>
                                            <td className={ShellTableStyles.td + " text-zinc-500"}>{grn.warehouseName}</td>
                                            <td className={ShellTableStyles.td + " text-zinc-500 font-medium"}>
                                                {new Date(grn.receivedDate).toLocaleDateString("id-ID")}
                                            </td>
                                            <td className={ShellTableStyles.td + " text-center"}>
                                                <StatusBadge
                                                    status={grn.status}
                                                    variant={grn.status === "ACCEPTED" ? "approved" : grn.status === "INSPECTING" ? "production" : undefined}
                                                />
                                            </td>
                                            <td className={ShellTableStyles.td + " text-center"}>
                                                <span className="font-black text-emerald-600">{grn.totalAccepted}</span>
                                                {grn.totalRejected > 0 && (
                                                    <span className="text-red-500 text-[10px] ml-1">(-{grn.totalRejected})</span>
                                                )}
                                            </td>
                                            <td className={ShellTableStyles.td + " text-right"} onClick={(e) => e.stopPropagation()}>
                                                <ActionButtonGroup actions={actions} />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </DataTableShell>
                )}
            </ModulePageLayout>

            {/* GRN Details Sheet */}
            <GRNDetailsSheet
                grn={selectedGRN}
                isOpen={!!selectedGRN}
                onClose={() => setSelectedGRN(null)}
            />
        </div>
    )
}
