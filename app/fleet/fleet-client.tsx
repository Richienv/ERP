"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    IconPlus, IconSearch, IconAlertTriangle, IconTruck, IconBulldozer,
    IconCar, IconShoppingCart, IconBuildingFactory, IconClipboardCheck,
    IconX
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Vehicle = Awaited<ReturnType<typeof import("@/lib/actions/vehicles").getVehicles>>[number]
type Stats = Awaited<ReturnType<typeof import("@/lib/actions/vehicles").getVehicleStats>>

const STATUS_LABEL: Record<string, string> = {
    AVAILABLE: "Siap Dipakai",
    RENTED: "Disewakan",
    IN_SERVICE: "Di Bengkel",
    RESERVED: "Dipesan",
    SOLD: "Terjual",
    WRITTEN_OFF: "Dihapus",
    INACTIVE: "Non-Aktif",
}

const STATUS_COLOR: Record<string, string> = {
    AVAILABLE: "bg-emerald-100 text-emerald-700 border-emerald-300",
    RENTED: "bg-blue-100 text-blue-700 border-blue-300",
    IN_SERVICE: "bg-amber-100 text-amber-700 border-amber-300",
    RESERVED: "bg-purple-100 text-purple-700 border-purple-300",
    SOLD: "bg-zinc-100 text-zinc-700 border-zinc-300",
    WRITTEN_OFF: "bg-red-100 text-red-700 border-red-300",
    INACTIVE: "bg-zinc-100 text-zinc-500 border-zinc-300",
}

const TYPE_LABEL: Record<string, string> = {
    LIGHT_VEHICLE: "Kendaraan Ringan",
    HEAVY_EQUIPMENT: "Alat Berat",
    TRUCK: "Truk",
    TRAILER: "Trailer",
    MOTORCYCLE: "Motor / ATV",
    OTHER: "Lainnya",
}

const TYPE_ICON: Record<string, React.ElementType> = {
    LIGHT_VEHICLE: IconCar,
    HEAVY_EQUIPMENT: IconBulldozer,
    TRUCK: IconTruck,
    TRAILER: IconShoppingCart,
    MOTORCYCLE: IconCar,
    OTHER: IconBuildingFactory,
}

interface FleetClientProps {
    initialVehicles: Vehicle[]
    initialStats: Stats
}

export function FleetClient({ initialVehicles, initialStats }: FleetClientProps) {
    const router = useRouter()
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("ALL")
    const [typeFilter, setTypeFilter] = useState<string>("ALL")

    const filtered = useMemo(() => {
        return initialVehicles.filter((v) => {
            if (statusFilter !== "ALL" && v.status !== statusFilter) return false
            if (typeFilter !== "ALL" && v.vehicleType !== typeFilter) return false
            if (search) {
                const q = search.toLowerCase()
                if (!v.plateNumber.toLowerCase().includes(q) &&
                    !v.brand.toLowerCase().includes(q) &&
                    !v.model.toLowerCase().includes(q)) return false
            }
            return true
        })
    }, [initialVehicles, statusFilter, typeFilter, search])

    return (
        <div className="mf-page">
            <div className={NB.pageCard}>
                <div className={NB.pageAccent} />

                {/* Row 1: Title + actions */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-200">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-500 p-2 rounded">
                            <IconTruck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-tight">Armada</h1>
                            <p className="text-xs text-zinc-500">Master data kendaraan, alat berat, dan armada rental</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => router.push("/fleet/new")}
                        className={NB.toolbarBtnPrimary}
                    >
                        <IconPlus className="w-3.5 h-3.5 mr-1" /> Tambah Armada
                    </Button>
                </div>

                {/* Row 2: KPI Strip */}
                <div className={NB.kpiStrip}>
                    <KpiCell
                        dotColor="bg-zinc-700"
                        label="Total Armada"
                        count={initialStats.total}
                        amount=""
                    />
                    <KpiCell
                        dotColor="bg-emerald-500"
                        label="Siap Dipakai"
                        count={initialStats.byStatus.AVAILABLE ?? 0}
                        amount=""
                    />
                    <KpiCell
                        dotColor="bg-blue-500"
                        label="Disewakan"
                        count={initialStats.byStatus.RENTED ?? 0}
                        amount=""
                    />
                    <KpiCell
                        dotColor="bg-amber-500"
                        label="Di Bengkel"
                        count={initialStats.byStatus.IN_SERVICE ?? 0}
                        amount=""
                    />
                    <KpiCell
                        dotColor="bg-red-500"
                        label="Dokumen Akan Habis"
                        count={initialStats.expiringDocsCount}
                        amount={initialStats.expiringDocsCount > 0 ? "≤30 hari" : ""}
                        urgent={initialStats.expiringDocsCount > 0}
                    />
                </div>

                {/* Row 3: Filter toolbar */}
                <div className={NB.filterBar}>
                    <div className="relative flex-1 max-w-md">
                        <IconSearch className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${search ? NB.inputIconActive : NB.inputIconEmpty}`} />
                        <Input
                            placeholder="Cari plat, merk, atau model..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className={`h-9 pl-8 pr-8 text-xs rounded-none border-r-0 ${search ? NB.inputActive : NB.inputEmpty}`}
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                            >
                                <IconX className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className={`h-9 w-[160px] text-[11px] uppercase tracking-wider font-bold rounded-none border-r-0 ${statusFilter !== "ALL" ? NB.inputActive : NB.inputEmpty}`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Semua Status</SelectItem>
                            {Object.entries(STATUS_LABEL).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className={`h-9 w-[160px] text-[11px] uppercase tracking-wider font-bold rounded-none ${typeFilter !== "ALL" ? NB.inputActive : NB.inputEmpty}`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Semua Tipe</SelectItem>
                            {Object.entries(TYPE_LABEL).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <span className="ml-auto text-xs text-zinc-500">
                        {filtered.length} dari {initialVehicles.length}
                    </span>
                </div>

                {/* Row 4: Vehicle table/grid */}
                <div className="overflow-x-auto">
                    {filtered.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <table className="w-full">
                            <thead className="bg-zinc-50 border-b border-zinc-200">
                                <tr className="text-[10px] uppercase tracking-wider font-bold text-zinc-600">
                                    <th className="text-left p-3">Plat / Identifikasi</th>
                                    <th className="text-left p-3">Merk / Model</th>
                                    <th className="text-center p-3">Tipe</th>
                                    <th className="text-center p-3">Status</th>
                                    <th className="text-left p-3">Dokumen</th>
                                    <th className="text-right p-3">Tarif Sewa</th>
                                    <th className="text-left p-3">Lokasi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((v) => (
                                    <VehicleRow key={v.id} vehicle={v} />
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}

function KpiCell({ dotColor, label, count, amount, urgent }: {
    dotColor: string; label: string; count: number; amount: string; urgent?: boolean
}) {
    return (
        <div className={NB.kpiCell}>
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-600">{label}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
                <span className={`text-xl font-black ${urgent ? "text-red-600" : "text-zinc-900"}`}>{count}</span>
                {amount && <span className="text-[10px] font-mono font-bold text-zinc-500">{amount}</span>}
            </div>
        </div>
    )
}

function VehicleRow({ vehicle: v }: { vehicle: Vehicle }) {
    const TypeIcon = TYPE_ICON[v.vehicleType] || IconCar
    const router = useRouter()

    return (
        <tr
            className="border-b border-zinc-200 hover:bg-zinc-50 cursor-pointer"
            onClick={() => router.push(`/fleet/${v.id}`)}
        >
            <td className="p-3">
                <div className="font-mono font-bold text-sm">{v.plateNumber}</div>
                {v.vin && <div className="text-[10px] text-zinc-500 font-mono">VIN: {v.vin.slice(-8)}</div>}
            </td>
            <td className="p-3">
                <div className="font-semibold text-sm">{v.brand} {v.model}</div>
                <div className="text-[11px] text-zinc-500">{v.variant ?? ""} {v.year} {v.color ? `· ${v.color}` : ""}</div>
            </td>
            <td className="p-3 text-center">
                <div className="inline-flex items-center gap-1.5">
                    <TypeIcon className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-xs">{TYPE_LABEL[v.vehicleType] || v.vehicleType}</span>
                </div>
            </td>
            <td className="p-3 text-center">
                <Badge className={`${STATUS_COLOR[v.status] || ""} font-bold uppercase text-[10px] tracking-wider`}>
                    {STATUS_LABEL[v.status] || v.status}
                </Badge>
            </td>
            <td className="p-3">
                <div className="flex flex-col gap-0.5 text-[10px]">
                    <ComplianceBadge label="STNK" expiry={v.stnkExpiry} overdue={v.compliance.stnkOverdue} soon={v.compliance.stnkSoon} />
                    <ComplianceBadge label="KIR" expiry={v.kirExpiry} overdue={v.compliance.kirOverdue} soon={v.compliance.kirSoon} />
                    <ComplianceBadge label="Asuransi" expiry={v.insuranceExpiry} overdue={v.compliance.insuranceOverdue} soon={v.compliance.insuranceSoon} />
                </div>
            </td>
            <td className="p-3 text-right">
                {v.dailyRate ? (
                    <div className="text-xs font-mono font-bold">{formatIDR(v.dailyRate)}/hari</div>
                ) : v.monthlyRate ? (
                    <div className="text-xs font-mono font-bold">{formatIDR(v.monthlyRate)}/bln</div>
                ) : (
                    <span className="text-xs text-zinc-400">—</span>
                )}
            </td>
            <td className="p-3">
                {v.warehouse ? (
                    <div className="text-xs">{v.warehouse.name}</div>
                ) : v.currentLocation ? (
                    <div className="text-xs">{v.currentLocation}</div>
                ) : (
                    <span className="text-xs text-zinc-400">—</span>
                )}
                {v.ownerCustomer && (
                    <div className="text-[10px] text-zinc-500 mt-0.5">Milik: {v.ownerCustomer.name}</div>
                )}
            </td>
        </tr>
    )
}

function ComplianceBadge({ label, expiry, overdue, soon }: {
    label: string; expiry: Date | null; overdue: boolean; soon: boolean
}) {
    if (!expiry) return <span className="text-zinc-400">{label}: —</span>
    const dateStr = new Date(expiry).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    if (overdue) return <span className="text-red-600 font-bold">⚠ {label}: HABIS {dateStr}</span>
    if (soon) return <span className="text-amber-600 font-semibold">⏱ {label}: {dateStr}</span>
    return <span className="text-zinc-600">{label}: {dateStr}</span>
}

function EmptyState() {
    return (
        <div className="text-center py-16 px-4">
            <IconClipboardCheck className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
            <h3 className="text-sm font-bold text-zinc-700">Belum ada armada</h3>
            <p className="text-xs text-zinc-500 mt-1 mb-4">Tambah kendaraan pertama untuk mulai tracking armada Anda</p>
            <Link href="/fleet/new">
                <Button className={NB.toolbarBtnPrimary}>
                    <IconPlus className="w-3.5 h-3.5 mr-1" /> Tambah Armada
                </Button>
            </Link>
        </div>
    )
}
