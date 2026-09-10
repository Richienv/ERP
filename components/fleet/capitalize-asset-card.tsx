"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { capitalizeVehicleAsAsset } from "@/lib/actions/vehicles"
import { NB } from "@/lib/dialog-styles"
import { formatIDR } from "@/lib/utils"

export function CapitalizeAssetCard({
    vehicleId,
    plateNumber,
    existingAsset,
}: {
    vehicleId: string
    plateNumber: string
    existingAsset?: { id: string; assetCode: string; netBookValue: number } | null
}) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)
    const [purchaseCost, setPurchaseCost] = useState("")
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
    const [usefulLifeMonths, setUsefulLifeMonths] = useState("60")
    const [fundingSource, setFundingSource] = useState<"OPENING_BALANCE" | "BANK" | "CASH">("OPENING_BALANCE")
    const [saving, setSaving] = useState(false)

    if (existingAsset) {
        return (
            <div className="border-2 border-emerald-400 bg-emerald-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Sudah aset tetap</div>
                <div className="text-lg font-black font-mono mt-1">{existingAsset.assetCode}</div>
                <div className="text-xs text-emerald-800 mt-1">NBV {formatIDR(existingAsset.netBookValue)}</div>
                <Button
                    type="button"
                    className={`${NB.toolbarBtn} mt-3 ml-0`}
                    onClick={() => router.push(`/finance/fixed-assets`)}
                >
                    Buka register aset
                </Button>
            </div>
        )
    }

    const submit = async () => {
        setSaving(true)
        try {
            const result = await capitalizeVehicleAsAsset(vehicleId, {
                purchaseCost: Number(purchaseCost),
                purchaseDate,
                usefulLifeMonths: Number(usefulLifeMonths) || 60,
                fundingSource,
            })
            if (result.success) {
                toast.success(`${plateNumber} jadi aset ${result.assetCode}`)
                queryClient.invalidateQueries({ queryKey: queryKeys.miningCommand.pulse() })
                router.refresh()
            } else {
                toast.error(result.error)
            }
        } catch (error: any) {
            toast.error(error?.message || "Gagal kapitalisasi")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0_0_#000]">
            <div className="text-[10px] font-black uppercase tracking-widest text-orange-600">Wow — 1 klik ke buku</div>
            <h3 className="text-sm font-black uppercase mt-1">Jadikan aset tetap</h3>
            <p className="text-[11px] text-zinc-500 mt-1">
                Posting DR Kendaraan / CR Saldo Awal, lalu unit ini masuk depresiasi bulanan.
            </p>
            {!open ? (
                <Button type="button" className={`${NB.toolbarBtnPrimary} ml-0 mt-3`} onClick={() => setOpen(true)}>
                    Kapitalisasi {plateNumber}
                </Button>
            ) : (
                <div className="mt-3 space-y-2">
                    <div>
                        <Label className={NB.label}>Nilai perolehan (Rp)</Label>
                        <Input
                            className={`${NB.input} ${purchaseCost ? NB.inputActive : NB.inputEmpty}`}
                            inputMode="numeric"
                            value={purchaseCost}
                            onChange={(e) => setPurchaseCost(e.target.value.replace(/[^\d]/g, ""))}
                            placeholder="450000000"
                        />
                    </div>
                    <div>
                        <Label className={NB.label}>Tanggal perolehan</Label>
                        <Input
                            type="date"
                            className={`${NB.input} ${NB.inputActive}`}
                            value={purchaseDate}
                            onChange={(e) => setPurchaseDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label className={NB.label}>Umur manfaat (bulan)</Label>
                        <Input
                            className={`${NB.input} ${NB.inputActive}`}
                            value={usefulLifeMonths}
                            onChange={(e) => setUsefulLifeMonths(e.target.value.replace(/[^\d]/g, ""))}
                        />
                    </div>
                    <div>
                        <Label className={NB.label}>Sumber dana</Label>
                        <Select value={fundingSource} onValueChange={(v) => setFundingSource(v as typeof fundingSource)}>
                            <SelectTrigger className={`${NB.select} ${NB.inputActive}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="OPENING_BALANCE">Saldo awal / sudah dimiliki</SelectItem>
                                <SelectItem value="BANK">Bayar dari bank</SelectItem>
                                <SelectItem value="CASH">Bayar tunai</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <Button type="button" className={NB.cancelBtn} onClick={() => setOpen(false)}>Batal</Button>
                        <Button type="button" className={NB.submitBtnOrange} disabled={saving || !purchaseCost} onClick={submit}>
                            {saving ? "Memposting..." : "Posting ke GL"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
