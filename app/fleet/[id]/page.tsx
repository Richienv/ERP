import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { getVehicleById } from "@/lib/actions/vehicles"
import { VehicleForm } from "../vehicle-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconArrowLeft, IconEdit, IconTruck } from "@tabler/icons-react"
import { formatIDR } from "@/lib/utils"
import { NB } from "@/lib/dialog-styles"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
    AVAILABLE: "Siap Dipakai",
    RENTED: "Disewakan",
    IN_SERVICE: "Di Bengkel",
    RESERVED: "Dipesan",
    SOLD: "Terjual",
    WRITTEN_OFF: "Dihapus",
    INACTIVE: "Non-Aktif",
}

export default async function VehicleDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ edit?: string }>
}) {
    const { id } = await params
    const { edit } = await searchParams
    const vehicle = await getVehicleById(id)

    if (!vehicle) notFound()

    if (edit === "1") {
        const [warehouses, customers] = await Promise.all([
            prisma.warehouse.findMany({
                where: { isActive: true },
                select: { id: true, code: true, name: true },
                orderBy: { name: "asc" },
            }),
            prisma.customer.findMany({
                select: { id: true, code: true, name: true },
                orderBy: { name: "asc" },
                take: 500,
            }),
        ])
        return <VehicleForm initial={{
            id: vehicle.id,
            plateNumber: vehicle.plateNumber,
            vin: vehicle.vin,
            engineNumber: vehicle.engineNumber,
            brand: vehicle.brand,
            model: vehicle.model,
            variant: vehicle.variant,
            year: vehicle.year,
            color: vehicle.color,
            bpkbNumber: vehicle.bpkbNumber,
            stnkNumber: vehicle.stnkNumber,
            stnkExpiry: vehicle.stnkExpiry?.toISOString().slice(0, 10) ?? null,
            kirNumber: vehicle.kirNumber,
            kirExpiry: vehicle.kirExpiry?.toISOString().slice(0, 10) ?? null,
            insurancePolicyNumber: vehicle.insurancePolicyNumber,
            insuranceExpiry: vehicle.insuranceExpiry?.toISOString().slice(0, 10) ?? null,
            insurer: vehicle.insurer,
            vehicleType: vehicle.vehicleType,
            status: vehicle.status,
            warehouseId: vehicle.warehouseId,
            currentLocation: vehicle.currentLocation,
            odometer: vehicle.odometer,
            engineHours: vehicle.engineHours,
            dailyRate: vehicle.dailyRate,
            monthlyRate: vehicle.monthlyRate,
            ownerCustomerId: vehicle.ownerCustomerId,
            notes: vehicle.notes,
        }} warehouses={warehouses} customers={customers} />
    }

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <Link href="/fleet">
                        <Button variant="ghost" size="sm" className="gap-1">
                            <IconArrowLeft className="w-4 h-4" /> Kembali ke Armada
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-500 p-2 rounded">
                            <IconTruck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight font-mono">{vehicle.plateNumber}</h1>
                            <p className="text-sm text-zinc-500">{vehicle.brand} {vehicle.model} {vehicle.variant ?? ""} · {vehicle.year}</p>
                        </div>
                    </div>
                </div>
                <Link href={`/fleet/${vehicle.id}?edit=1`}>
                    <Button className={NB.toolbarBtnPrimary}>
                        <IconEdit className="w-4 h-4 mr-1.5" /> Edit
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm">Informasi Kendaraan</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                        <Detail label="Status" value={
                            <Badge className="font-bold uppercase text-[10px] tracking-wider">{STATUS_LABEL[vehicle.status] || vehicle.status}</Badge>
                        } />
                        <Detail label="Tipe" value={vehicle.vehicleType} />
                        <Detail label="Warna" value={vehicle.color || "—"} />
                        <Detail label="VIN / Chassis" value={<span className="font-mono">{vehicle.vin || "—"}</span>} />
                        <Detail label="No. Mesin" value={<span className="font-mono">{vehicle.engineNumber || "—"}</span>} />
                        <Detail label="Odometer" value={vehicle.odometer ? `${vehicle.odometer.toLocaleString("id-ID")} km` : "—"} />
                        <Detail label="Jam Kerja" value={vehicle.engineHours ? `${vehicle.engineHours} jam` : "—"} />
                        <Detail label="Lokasi Gudang" value={vehicle.warehouse?.name || "—"} />
                        <Detail label="Lokasi Site" value={vehicle.currentLocation || "—"} />
                        <Detail label="Pemilik" value={vehicle.ownerCustomer?.name || "Perusahaan sendiri"} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Tarif Sewa</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div>
                            <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Harian</div>
                            <div className="text-lg font-mono font-bold">{vehicle.dailyRate ? formatIDR(vehicle.dailyRate) : "—"}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Bulanan</div>
                            <div className="text-lg font-mono font-bold">{vehicle.monthlyRate ? formatIDR(vehicle.monthlyRate) : "—"}</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="md:col-span-3">
                    <CardHeader>
                        <CardTitle className="text-sm">Dokumen</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <DocBlock title="BPKB" number={vehicle.bpkbNumber} expiry={null} />
                        <DocBlock title="STNK" number={vehicle.stnkNumber} expiry={vehicle.stnkExpiry} />
                        <DocBlock title="KIR" number={vehicle.kirNumber} expiry={vehicle.kirExpiry} />
                        <DocBlock title="Asuransi" number={vehicle.insurancePolicyNumber} expiry={vehicle.insuranceExpiry} insurer={vehicle.insurer} />
                    </CardContent>
                </Card>

                {vehicle.notes && (
                    <Card className="md:col-span-3">
                        <CardHeader>
                            <CardTitle className="text-sm">Catatan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm whitespace-pre-wrap">{vehicle.notes}</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">{label}</div>
            <div className="text-sm">{value}</div>
        </div>
    )
}

function DocBlock({ title, number, expiry, insurer }: {
    title: string; number?: string | null; expiry?: Date | null; insurer?: string | null
}) {
    const now = new Date()
    const overdue = expiry && new Date(expiry) < now
    const soon = expiry && new Date(expiry) >= now && new Date(expiry) <= new Date(now.getTime() + 30 * 86400_000)

    return (
        <div className={`border-2 rounded p-3 ${overdue ? "border-red-300 bg-red-50/50" : soon ? "border-amber-300 bg-amber-50/50" : "border-zinc-200"}`}>
            <div className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider mb-1">{title}</div>
            <div className="text-sm font-semibold">{number || "—"}</div>
            {insurer && <div className="text-xs text-zinc-500 mt-0.5">{insurer}</div>}
            {expiry ? (
                <div className={`text-xs mt-1 font-medium ${overdue ? "text-red-700" : soon ? "text-amber-700" : "text-zinc-600"}`}>
                    {overdue ? "⚠ HABIS " : soon ? "⏱ Akan habis " : "Berlaku s/d "}
                    {new Date(expiry).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
            ) : null}
        </div>
    )
}
