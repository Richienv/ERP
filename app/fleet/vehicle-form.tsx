"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { IconArrowLeft, IconDeviceFloppy, IconTruck } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { createVehicle, updateVehicle, type CreateVehicleInput } from "@/lib/actions/vehicles"
import { NB } from "@/lib/dialog-styles"

interface VehicleFormProps {
    initial?: Partial<CreateVehicleInput> & { id?: string }
    warehouses: Array<{ id: string; code: string; name: string }>
    customers: Array<{ id: string; code: string; name: string }>
}

const VEHICLE_TYPE_OPTIONS = [
    { value: "LIGHT_VEHICLE", label: "Kendaraan Ringan (DC, Pickup)" },
    { value: "HEAVY_EQUIPMENT", label: "Alat Berat (PC200, Bulldozer, dll)" },
    { value: "TRUCK", label: "Truk (Dump truck, Hauling)" },
    { value: "TRAILER", label: "Trailer / Lowbed" },
    { value: "MOTORCYCLE", label: "Motor / ATV" },
    { value: "OTHER", label: "Lainnya" },
]

export function VehicleForm({ initial, warehouses, customers }: VehicleFormProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const isEdit = !!initial?.id

    const [form, setForm] = useState<CreateVehicleInput>({
        plateNumber: initial?.plateNumber ?? "",
        vin: initial?.vin ?? "",
        engineNumber: initial?.engineNumber ?? "",
        brand: initial?.brand ?? "",
        model: initial?.model ?? "",
        variant: initial?.variant ?? "",
        year: initial?.year ?? new Date().getFullYear(),
        color: initial?.color ?? "",
        bpkbNumber: initial?.bpkbNumber ?? "",
        stnkNumber: initial?.stnkNumber ?? "",
        stnkExpiry: initial?.stnkExpiry ?? "",
        kirNumber: initial?.kirNumber ?? "",
        kirExpiry: initial?.kirExpiry ?? "",
        insurancePolicyNumber: initial?.insurancePolicyNumber ?? "",
        insuranceExpiry: initial?.insuranceExpiry ?? "",
        insurer: initial?.insurer ?? "",
        vehicleType: initial?.vehicleType ?? "LIGHT_VEHICLE",
        status: initial?.status ?? "AVAILABLE",
        warehouseId: initial?.warehouseId ?? null,
        currentLocation: initial?.currentLocation ?? "",
        odometer: initial?.odometer ?? null,
        engineHours: initial?.engineHours ?? null,
        dailyRate: initial?.dailyRate ?? null,
        monthlyRate: initial?.monthlyRate ?? null,
        ownerCustomerId: initial?.ownerCustomerId ?? null,
        notes: initial?.notes ?? "",
    })

    const handleChange = <K extends keyof CreateVehicleInput>(key: K, value: CreateVehicleInput[K]) => {
        setForm((p) => ({ ...p, [key]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        try {
            const result = isEdit && initial?.id
                ? await updateVehicle(initial.id, form)
                : await createVehicle(form)
            if (result.success) {
                toast.success(isEdit ? "Armada diperbarui" : "Armada baru disimpan")
                router.push("/fleet")
            } else {
                toast.error(result.error || "Gagal menyimpan")
            }
        } catch (err: any) {
            toast.error(err?.message || "Terjadi kesalahan")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <Link href="/fleet">
                        <Button variant="ghost" size="sm" className="gap-1">
                            <IconArrowLeft className="w-4 h-4" /> Kembali
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight">
                            {isEdit ? "Edit Armada" : "Tambah Armada Baru"}
                        </h1>
                        <p className="text-xs text-zinc-500">Lengkapi data kendaraan / alat berat</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* IDENTIFIKASI */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                            <IconTruck className="w-4 h-4" /> Identifikasi Kendaraan
                        </CardTitle>
                        <CardDescription>Plat, merk, model, dan ID unik kendaraan</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Plat Nomor *" required>
                            <Input
                                value={form.plateNumber}
                                onChange={(e) => handleChange("plateNumber", e.target.value.toUpperCase())}
                                placeholder="BD 1234 ABC"
                                required
                            />
                        </Field>
                        <Field label="Tipe Kendaraan *">
                            <Select value={form.vehicleType} onValueChange={(v) => handleChange("vehicleType", v as any)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {VEHICLE_TYPE_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Status">
                            <Select value={form.status ?? "AVAILABLE"} onValueChange={(v) => handleChange("status", v as any)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AVAILABLE">Siap Dipakai</SelectItem>
                                    <SelectItem value="RENTED">Disewakan</SelectItem>
                                    <SelectItem value="IN_SERVICE">Di Bengkel</SelectItem>
                                    <SelectItem value="RESERVED">Dipesan</SelectItem>
                                    <SelectItem value="INACTIVE">Non-Aktif</SelectItem>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Merk *" required>
                            <Input value={form.brand} onChange={(e) => handleChange("brand", e.target.value)} placeholder="Toyota, Komatsu" required />
                        </Field>
                        <Field label="Model *" required>
                            <Input value={form.model} onChange={(e) => handleChange("model", e.target.value)} placeholder="Hilux DC, PC200-8" required />
                        </Field>
                        <Field label="Varian">
                            <Input value={form.variant ?? ""} onChange={(e) => handleChange("variant", e.target.value)} placeholder="2.4L V Diesel" />
                        </Field>
                        <Field label="Tahun *" required>
                            <Input
                                type="number"
                                value={form.year}
                                onChange={(e) => handleChange("year", parseInt(e.target.value) || new Date().getFullYear())}
                                min={1990}
                                max={new Date().getFullYear() + 1}
                                required
                            />
                        </Field>
                        <Field label="Warna">
                            <Input value={form.color ?? ""} onChange={(e) => handleChange("color", e.target.value)} placeholder="Hitam, Putih" />
                        </Field>
                        <Field label="Nomor Mesin / Chassis (VIN)">
                            <Input value={form.vin ?? ""} onChange={(e) => handleChange("vin", e.target.value)} placeholder="MR053HFD..." />
                        </Field>
                        <Field label="Nomor Mesin">
                            <Input value={form.engineNumber ?? ""} onChange={(e) => handleChange("engineNumber", e.target.value)} placeholder="2GD1234..." />
                        </Field>
                    </CardContent>
                </Card>

                {/* DOKUMEN */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Dokumen Kendaraan</CardTitle>
                        <CardDescription>BPKB, STNK, KIR, dan asuransi — penting untuk compliance tambang</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="No. BPKB">
                            <Input value={form.bpkbNumber ?? ""} onChange={(e) => handleChange("bpkbNumber", e.target.value)} />
                        </Field>
                        <Field label="No. STNK">
                            <Input value={form.stnkNumber ?? ""} onChange={(e) => handleChange("stnkNumber", e.target.value)} />
                        </Field>
                        <Field label="STNK Berlaku Sampai">
                            <Input
                                type="date"
                                value={form.stnkExpiry ? form.stnkExpiry.toString().slice(0, 10) : ""}
                                onChange={(e) => handleChange("stnkExpiry", e.target.value || null)}
                            />
                        </Field>
                        <Field label="No. KIR (Kendaraan Niaga)">
                            <Input value={form.kirNumber ?? ""} onChange={(e) => handleChange("kirNumber", e.target.value)} />
                        </Field>
                        <Field label="KIR Berlaku Sampai">
                            <Input
                                type="date"
                                value={form.kirExpiry ? form.kirExpiry.toString().slice(0, 10) : ""}
                                onChange={(e) => handleChange("kirExpiry", e.target.value || null)}
                            />
                        </Field>
                        <Field label="Perusahaan Asuransi">
                            <Input value={form.insurer ?? ""} onChange={(e) => handleChange("insurer", e.target.value)} placeholder="Astra, Allianz, dll" />
                        </Field>
                        <Field label="No. Polis Asuransi">
                            <Input value={form.insurancePolicyNumber ?? ""} onChange={(e) => handleChange("insurancePolicyNumber", e.target.value)} />
                        </Field>
                        <Field label="Asuransi Berlaku Sampai">
                            <Input
                                type="date"
                                value={form.insuranceExpiry ? form.insuranceExpiry.toString().slice(0, 10) : ""}
                                onChange={(e) => handleChange("insuranceExpiry", e.target.value || null)}
                            />
                        </Field>
                    </CardContent>
                </Card>

                {/* OPERASIONAL & TARIF */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Operasional & Tarif Sewa</CardTitle>
                        <CardDescription>Lokasi, metrik, dan tarif rental (kosongkan kalau bukan untuk disewakan)</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Gudang / Lokasi Parkir">
                            <Select value={form.warehouseId ?? "none"} onValueChange={(v) => handleChange("warehouseId", v === "none" ? null : v)}>
                                <SelectTrigger><SelectValue placeholder="Pilih gudang..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">— Tidak ada —</SelectItem>
                                    {warehouses.map((w) => (
                                        <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Lokasi Saat Ini (Site)">
                            <Input value={form.currentLocation ?? ""} onChange={(e) => handleChange("currentLocation", e.target.value)} placeholder="Site Tabang, dll" />
                        </Field>
                        <Field label="Pemilik Customer (kalau servis eksternal)">
                            <Select value={form.ownerCustomerId ?? "none"} onValueChange={(v) => handleChange("ownerCustomerId", v === "none" ? null : v)}>
                                <SelectTrigger><SelectValue placeholder="Milik perusahaan sendiri" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">— Milik perusahaan —</SelectItem>
                                    {customers.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field label="Odometer (km)">
                            <Input
                                type="number"
                                value={form.odometer ?? ""}
                                onChange={(e) => handleChange("odometer", e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="0"
                            />
                        </Field>
                        <Field label="Jam Kerja Mesin (alat berat)">
                            <Input
                                type="number"
                                step="0.1"
                                value={form.engineHours ?? ""}
                                onChange={(e) => handleChange("engineHours", e.target.value ? parseFloat(e.target.value) : null)}
                                placeholder="0.0"
                            />
                        </Field>
                        <div />
                        <Field label="Tarif Sewa Harian (Rp)">
                            <Input
                                type="number"
                                value={form.dailyRate ?? ""}
                                onChange={(e) => handleChange("dailyRate", e.target.value ? parseFloat(e.target.value) : null)}
                                placeholder="750000"
                            />
                        </Field>
                        <Field label="Tarif Sewa Bulanan (Rp)">
                            <Input
                                type="number"
                                value={form.monthlyRate ?? ""}
                                onChange={(e) => handleChange("monthlyRate", e.target.value ? parseFloat(e.target.value) : null)}
                                placeholder="18000000"
                            />
                        </Field>
                    </CardContent>
                </Card>

                {/* CATATAN */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Catatan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            value={form.notes ?? ""}
                            onChange={(e) => handleChange("notes", e.target.value)}
                            placeholder="Catatan tambahan..."
                            rows={3}
                        />
                    </CardContent>
                </Card>

                {/* ACTIONS */}
                <div className="flex items-center justify-end gap-3">
                    <Link href="/fleet">
                        <Button type="button" variant="outline">Batal</Button>
                    </Link>
                    <Button type="submit" disabled={isSubmitting} className={NB.toolbarBtnPrimary}>
                        <IconDeviceFloppy className="w-4 h-4 mr-1.5" />
                        {isSubmitting ? "Menyimpan..." : isEdit ? "Update Armada" : "Simpan Armada"}
                    </Button>
                </div>
            </form>
        </div>
    )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div>
            <Label className="text-[11px] uppercase font-bold tracking-wider text-zinc-600">
                {label}
            </Label>
            <div className="mt-1">{children}</div>
        </div>
    )
}
