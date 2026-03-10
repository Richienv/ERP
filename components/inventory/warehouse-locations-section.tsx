"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    getWarehouseLocations,
    createWarehouseLocation,
    deleteWarehouseLocation,
} from "@/app/actions/inventory"
import { Layers, Plus, Trash2, MapPin, Archive, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"

interface WarehouseLocationsSectionProps {
    warehouseId: string
}

export function WarehouseLocationsSection({ warehouseId }: WarehouseLocationsSectionProps) {
    const queryClient = useQueryClient()
    const [createOpen, setCreateOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; code: string } | null>(null)

    // Form state
    const [code, setCode] = useState("")
    const [name, setName] = useState("")
    const [rack, setRack] = useState("")
    const [bin, setBin] = useState("")
    const [aisle, setAisle] = useState("")
    const [capacity, setCapacity] = useState("")

    const { data: locations = [], isLoading } = useQuery({
        queryKey: queryKeys.warehouseLocations.list(warehouseId),
        queryFn: () => getWarehouseLocations(warehouseId),
        enabled: !!warehouseId,
    })

    const createMutation = useMutation({
        mutationFn: createWarehouseLocation,
        onSuccess: (result) => {
            if (result.success) {
                toast.success("Lokasi berhasil ditambahkan")
                queryClient.invalidateQueries({ queryKey: queryKeys.warehouseLocations.list(warehouseId) })
                resetForm()
                setCreateOpen(false)
            } else {
                toast.error(result.error || "Gagal membuat lokasi")
            }
        },
    })

    const deleteMutation = useMutation({
        mutationFn: deleteWarehouseLocation,
        onSuccess: (result) => {
            if (result.success) {
                toast.success("Lokasi berhasil dihapus")
                queryClient.invalidateQueries({ queryKey: queryKeys.warehouseLocations.list(warehouseId) })
            } else {
                toast.error(result.error || "Gagal menghapus lokasi")
            }
            setDeleteTarget(null)
        },
    })

    function resetForm() {
        setCode("")
        setName("")
        setRack("")
        setBin("")
        setAisle("")
        setCapacity("")
    }

    function handleCreate() {
        if (!code.trim() || !name.trim()) {
            toast.error("Kode dan nama lokasi wajib diisi")
            return
        }
        createMutation.mutate({
            warehouseId,
            code: code.trim(),
            name: name.trim(),
            rack: rack.trim() || undefined,
            bin: bin.trim() || undefined,
            aisle: aisle.trim() || undefined,
            capacity: capacity ? parseInt(capacity, 10) : undefined,
        })
    }

    // Determine location type badge from fields
    function getTypeBadge(loc: { rack?: string | null; bin?: string | null; aisle?: string | null }) {
        const badges = []
        if (loc.aisle) badges.push({ label: `Aisle: ${loc.aisle}`, className: "bg-purple-100 text-purple-800 border-purple-300" })
        if (loc.rack) badges.push({ label: `Rak: ${loc.rack}`, className: "bg-blue-100 text-blue-800 border-blue-300" })
        if (loc.bin) badges.push({ label: `Bin: ${loc.bin}`, className: "bg-amber-100 text-amber-800 border-amber-300" })
        return badges
    }

    return (
        <>
            <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-5 py-3 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-zinc-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            Lokasi Penyimpanan
                        </span>
                        <Badge className="text-[9px] font-black border-2 border-black bg-white text-black rounded-none px-1.5 py-0">
                            {locations.length}
                        </Badge>
                    </div>
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="bg-black text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all font-black uppercase text-[9px] tracking-wider px-3 h-7 rounded-none"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        Tambah Lokasi
                    </Button>
                </div>

                {isLoading ? (
                    <div className="p-8 text-center">
                        <div className="animate-pulse space-y-3">
                            <div className="h-4 bg-zinc-200 rounded w-32 mx-auto" />
                            <div className="h-3 bg-zinc-100 rounded w-48 mx-auto" />
                        </div>
                    </div>
                ) : locations.length === 0 ? (
                    <div className="p-8 text-center">
                        <MapPin className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Belum ada lokasi di gudang ini
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-1">
                            Tambahkan rak, bin, atau zona untuk mengatur penyimpanan
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2">
                        {locations.map((loc, idx) => {
                            const badges = getTypeBadge(loc)
                            return (
                                <div
                                    key={loc.id}
                                    className={`p-4 space-y-2 border-b-2 border-zinc-100 ${idx % 2 === 0 ? 'md:border-r-2 md:border-r-zinc-100' : ''}`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-block border-2 border-black bg-zinc-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider font-mono">
                                                {loc.code}
                                            </span>
                                            <h4 className="text-sm font-black uppercase tracking-tight">
                                                {loc.name}
                                            </h4>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-zinc-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={() => setDeleteTarget({ id: loc.id, code: loc.code })}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        {badges.map((b, i) => (
                                            <Badge
                                                key={i}
                                                className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded-none ${b.className}`}
                                            >
                                                {b.label}
                                            </Badge>
                                        ))}
                                        {badges.length === 0 && (
                                            <Badge className="text-[9px] font-black uppercase px-2 py-0.5 border rounded-none bg-zinc-100 text-zinc-600 border-zinc-300">
                                                Umum
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between pt-1 border-t border-zinc-200">
                                        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                                            {loc.capacity && (
                                                <span className="flex items-center gap-1 font-bold">
                                                    <Archive className="h-3 w-3" />
                                                    Kapasitas: {loc.capacity.toLocaleString()}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1 font-bold">
                                                <Hash className="h-3 w-3" />
                                                {loc.stockLevelCount} stok
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Create Dialog */}
            <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) resetForm() }}>
                <DialogContent className={NB.contentNarrow}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}>
                            <MapPin className="h-5 w-5" />
                            Tambah Lokasi Baru
                        </DialogTitle>
                        <p className={NB.subtitle}>Buat lokasi penyimpanan di gudang</p>
                    </DialogHeader>

                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={NB.label}>
                                    Kode <span className={NB.labelRequired}>*</span>
                                </label>
                                <Input
                                    className={NB.inputMono}
                                    placeholder="LOC-001"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className={NB.label}>
                                    Nama <span className={NB.labelRequired}>*</span>
                                </label>
                                <Input
                                    className={NB.input}
                                    placeholder="Rak Utama"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className={NB.label}>Aisle</label>
                                <Input
                                    className={NB.input}
                                    placeholder="A1"
                                    value={aisle}
                                    onChange={(e) => setAisle(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className={NB.label}>Rak</label>
                                <Input
                                    className={NB.input}
                                    placeholder="R01"
                                    value={rack}
                                    onChange={(e) => setRack(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className={NB.label}>Bin</label>
                                <Input
                                    className={NB.input}
                                    placeholder="B03"
                                    value={bin}
                                    onChange={(e) => setBin(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={NB.label}>Kapasitas (unit)</label>
                            <Input
                                className={NB.inputMono}
                                type="number"
                                placeholder="1000"
                                value={capacity}
                                onChange={(e) => setCapacity(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="px-6 pb-6">
                        <div className={NB.footer}>
                            <Button
                                className={NB.cancelBtn}
                                variant="outline"
                                onClick={() => { setCreateOpen(false); resetForm() }}
                            >
                                Batal
                            </Button>
                            <Button
                                className={NB.submitBtn}
                                onClick={handleCreate}
                                disabled={createMutation.isPending}
                            >
                                {createMutation.isPending ? "Menyimpan..." : "Simpan"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
                <AlertDialogContent className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black uppercase tracking-wider">
                            Hapus Lokasi?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Lokasi <span className="font-bold font-mono">{deleteTarget?.code}</span> akan dinonaktifkan.
                            Lokasi dengan stok aktif tidak dapat dihapus.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className={NB.cancelBtn}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-red-700 font-black uppercase text-xs tracking-wider px-6 h-9 rounded-none"
                            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                        >
                            {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
