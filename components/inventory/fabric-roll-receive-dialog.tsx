"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBSelect,
} from "@/components/ui/nb-dialog"
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create"
import { Info, Package, Plus, Ruler } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { receiveFabricRoll } from "@/lib/actions/fabric-rolls"

interface FabricRollReceiveDialogProps {
    products: { id: string; name: string; code: string }[]
    warehouses: { id: string; name: string; code: string }[]
    trigger?: React.ReactNode
}

export function FabricRollReceiveDialog({ products, warehouses, trigger }: FabricRollReceiveDialogProps) {
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const productOptions = products.map(p => ({ value: p.id, label: p.name, subtitle: p.code }))

    const [rollNumber, setRollNumber] = useState("")
    const [productId, setProductId] = useState("")
    const [warehouseId, setWarehouseId] = useState("")
    const [lengthMeters, setLengthMeters] = useState("")
    const [widthCm, setWidthCm] = useState("")
    const [weight, setWeight] = useState("")
    const [dyeLot, setDyeLot] = useState("")
    const [grade, setGrade] = useState("")
    const [locationBin, setLocationBin] = useState("")
    const [reference, setReference] = useState("")

    const resetForm = () => {
        setRollNumber("")
        setProductId("")
        setWarehouseId("")
        setLengthMeters("")
        setWidthCm("")
        setWeight("")
        setDyeLot("")
        setGrade("")
        setLocationBin("")
        setReference("")
    }

    const handleSubmit = async () => {
        if (!rollNumber || !productId || !warehouseId || !lengthMeters) {
            toast.error("Lengkapi semua field wajib")
            return
        }

        const meters = parseFloat(lengthMeters)
        if (isNaN(meters) || meters <= 0) {
            toast.error("Panjang harus > 0")
            return
        }

        setLoading(true)
        const result = await receiveFabricRoll({
            rollNumber,
            productId,
            warehouseId,
            lengthMeters: meters,
            widthCm: widthCm ? parseFloat(widthCm) : undefined,
            weight: weight ? parseFloat(weight) : undefined,
            dyeLot: dyeLot || undefined,
            grade: grade || undefined,
            locationBin: locationBin || undefined,
            reference: reference || undefined,
        })
        setLoading(false)

        if (result.success) {
            toast.success(`Roll ${rollNumber} berhasil diterima`)
            queryClient.invalidateQueries({ queryKey: queryKeys.fabricRolls.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
            resetForm()
            setOpen(false)
        } else {
            toast.error(result.error || "Gagal menerima roll")
        }
    }

    return (
        <>
            {trigger ? (
                <span onClick={() => setOpen(true)}>{trigger}</span>
            ) : (
                <Button
                    onClick={() => setOpen(true)}
                    className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
                >
                    <Plus className="mr-2 h-4 w-4" /> Terima Roll Baru
                </Button>
            )}

            <NBDialog open={open} onOpenChange={setOpen} size="wide">
                <NBDialogHeader
                    icon={Package}
                    title="Terima Fabric Roll"
                    subtitle="Daftarkan roll kain baru ke inventory"
                />

                <NBDialogBody>
                    {/* Basic */}
                    <NBSection icon={Ruler} title="Data Roll">
                        <div className="grid grid-cols-2 gap-3">
                            <NBInput
                                label="Nomor Roll"
                                required
                                value={rollNumber}
                                onChange={setRollNumber}
                                placeholder="ROLL-001"
                            />
                            <NBInput
                                label="Panjang (meter)"
                                required
                                type="number"
                                value={lengthMeters}
                                onChange={setLengthMeters}
                                placeholder="100.0"
                            />
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                                    Produk Kain <span className="text-red-500">*</span>
                                </label>
                                <ComboboxWithCreate
                                    options={productOptions}
                                    value={productId}
                                    onChange={setProductId}
                                    placeholder="Pilih kain..."
                                    searchPlaceholder="Cari produk kain..."
                                    emptyMessage="Produk tidak ditemukan."
                                />
                            </div>
                            <NBSelect
                                label="Gudang"
                                required
                                value={warehouseId}
                                onValueChange={setWarehouseId}
                                placeholder="Pilih gudang..."
                                options={warehouses.map((w) => ({
                                    value: w.id,
                                    label: `${w.code} — ${w.name}`,
                                }))}
                            />
                        </div>
                    </NBSection>

                    {/* Details */}
                    <NBSection icon={Info} title="Detail Tambahan" optional>
                        <div className="grid grid-cols-3 gap-3">
                            <NBInput
                                label="Lebar (cm)"
                                type="number"
                                value={widthCm}
                                onChange={setWidthCm}
                                placeholder="150.0"
                            />
                            <NBInput
                                label="Berat (kg)"
                                type="number"
                                value={weight}
                                onChange={setWeight}
                                placeholder="25.0"
                            />
                            <NBInput
                                label="Dye Lot"
                                value={dyeLot}
                                onChange={setDyeLot}
                                placeholder="LOT-2024-01"
                            />
                            <NBSelect
                                label="Grade"
                                value={grade}
                                onValueChange={setGrade}
                                placeholder="—"
                                options={[
                                    { value: "A", label: "A — Premium" },
                                    { value: "B", label: "B — Standar" },
                                    { value: "C", label: "C — Inferior" },
                                ]}
                            />
                            <NBInput
                                label="Lokasi Bin"
                                value={locationBin}
                                onChange={setLocationBin}
                                placeholder="R1-S2-B3"
                            />
                            <NBInput
                                label="Referensi"
                                value={reference}
                                onChange={setReference}
                                placeholder="PO-001"
                            />
                        </div>
                    </NBSection>
                </NBDialogBody>

                <NBDialogFooter
                    onCancel={() => setOpen(false)}
                    onSubmit={handleSubmit}
                    submitting={loading}
                    submitLabel="Terima Roll"
                />
            </NBDialog>
        </>
    )
}
