"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useCycleCounts } from "@/hooks/use-cycle-counts"
import { useWarehouses } from "@/hooks/use-warehouses"
import { queryKeys } from "@/lib/query-keys"
import {
    createCycleCountSession,
    submitCycleCountItems,
    finalizeCycleCount,
} from "@/app/actions/cycle-count"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { NB } from "@/lib/dialog-styles"
import {
    ClipboardList,
    Plus,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Hash,
    Warehouse,
    Calendar,
    ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import Link from "next/link"

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    SCHEDULED: { label: "Dijadwalkan", bg: "bg-blue-100", text: "text-blue-700" },
    IN_PROGRESS: { label: "Sedang Berlangsung", bg: "bg-amber-100", text: "text-amber-700" },
    COMPLETED: { label: "Selesai", bg: "bg-emerald-100", text: "text-emerald-700" },
}

export default function CycleCountsPage() {
    const { data: sessions, isLoading } = useCycleCounts()
    const { data: warehousesData } = useWarehouses()
    const warehouses = warehousesData ?? []
    const queryClient = useQueryClient()

    const [createOpen, setCreateOpen] = useState(false)
    const [countOpen, setCountOpen] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [finalizing, setFinalizing] = useState(false)

    const [newWarehouseId, setNewWarehouseId] = useState("")
    const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10))
    const [newNotes, setNewNotes] = useState("")

    const [counts, setCounts] = useState<Record<string, string>>({})

    const handleCreate = async () => {
        if (!newWarehouseId) {
            toast.error("Pilih gudang terlebih dahulu")
            return
        }
        setCreating(true)
        const result = await createCycleCountSession({
            warehouseId: newWarehouseId,
            scheduledDate: newDate,
            notes: newNotes || undefined,
        })
        setCreating(false)
        if (result.success) {
            toast.success("Sesi stok opname berhasil dibuat")
            setCreateOpen(false)
            setNewWarehouseId("")
            setNewNotes("")
            queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.all })
        } else {
            toast.error(result.error || "Gagal membuat sesi")
        }
    }

    const activeSession = sessions?.find((s) => s.id === countOpen)

    const handleOpenCount = (sessionId: string) => {
        const session = sessions?.find((s) => s.id === sessionId)
        if (session) {
            const initial: Record<string, string> = {}
            session.items.forEach((item) => {
                initial[item.id] = item.actualQty !== null ? String(item.actualQty) : ""
            })
            setCounts(initial)
            setCountOpen(sessionId)
        }
    }

    const handleSubmitCounts = async () => {
        if (!activeSession) return
        const entries = Object.entries(counts)
            .filter(([, val]) => val !== "")
            .map(([itemId, val]) => ({ itemId, actualQty: Number(val) }))

        if (entries.length === 0) {
            toast.error("Isi minimal 1 jumlah aktual")
            return
        }

        setSubmitting(true)
        const result = await submitCycleCountItems({
            sessionId: activeSession.id,
            counts: entries,
        })
        setSubmitting(false)

        if (result.success) {
            toast.success(`${entries.length} item berhasil disimpan`)
            queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.all })
        } else {
            toast.error(result.error || "Gagal menyimpan")
        }
    }

    const handleFinalize = async () => {
        if (!activeSession) return
        if (!window.confirm("Finalisasi stok opname? Selisih akan otomatis disesuaikan.")) return

        setFinalizing(true)
        const result = await finalizeCycleCount(activeSession.id)
        setFinalizing(false)

        if (result.success) {
            toast.success(`Stok opname selesai. ${result.adjustments} produk disesuaikan.`)
            setCountOpen(null)
            queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all })
        } else {
            toast.error(result.error || "Gagal finalisasi")
        }
    }

    if (isLoading) return <TablePageSkeleton accentColor="bg-amber-400" />

    return (
        <div className="mf-page">
            {/* COMMAND HEADER */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-amber-400">
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" asChild className="border-2 border-black h-8 w-8 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none">
                            <Link href="/inventory/audit"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight">Stok Opname Batch</h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">Hitung stok seluruh gudang dalam satu sesi</p>
                        </div>
                    </div>
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold text-[10px] tracking-wide hover:translate-y-[1px] hover:shadow-none transition-all h-9 rounded-none"
                    >
                        <Plus className="mr-2 h-3.5 w-3.5" /> Buat Sesi Baru
                    </Button>
                </div>
            </div>

            {/* KPI STRIP */}
            <div className="bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-b-2 md:border-b-0 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2"><Hash className="h-4 w-4 text-zinc-400" /><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Sesi</span></div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">{sessions?.length ?? 0}</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-b-2 md:border-b-0 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2"><ClipboardList className="h-4 w-4 text-zinc-400" /><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Berlangsung</span></div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">{sessions?.filter((s) => s.status !== "COMPLETED").length ?? 0}</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-b-2 md:border-b-0 border-zinc-100">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="h-4 w-4 text-zinc-400" /><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Selesai</span></div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">{sessions?.filter((s) => s.status === "COMPLETED").length ?? 0}</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-zinc-400" /><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Selisih Ditemukan</span></div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">{sessions?.reduce((acc, s) => acc + s.varianceCount, 0) ?? 0}</div>
                    </div>
                </div>
            </div>

            {/* SESSION LIST */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <Table>
                    <TableHeader className="bg-zinc-50 border-b-2 border-black">
                        <TableRow className="hover:bg-zinc-50">
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider">Gudang</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider">Tanggal</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-center">Item</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-center">Dihitung</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-center">Selisih</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-center">Status</TableHead>
                            <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!sessions || sessions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-zinc-400 font-medium">
                                    Belum ada sesi stok opname.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sessions.map((session) => {
                                const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.SCHEDULED
                                return (
                                    <TableRow key={session.id} className="hover:bg-zinc-50 border-b border-zinc-100">
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Warehouse className="h-3.5 w-3.5 text-zinc-400" />
                                                <div>
                                                    <div className="font-bold text-sm">{session.warehouseName}</div>
                                                    <div className="text-[10px] font-mono text-zinc-400">{session.warehouseCode}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-zinc-500">
                                            <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" />{new Date(session.scheduledDate).toLocaleDateString("id-ID")}</div>
                                        </TableCell>
                                        <TableCell className="text-center font-black">{session.itemCount}</TableCell>
                                        <TableCell className="text-center font-black text-blue-600">{session.countedCount}/{session.itemCount}</TableCell>
                                        <TableCell className="text-center">
                                            {session.varianceCount > 0 ? (
                                                <span className="font-black text-red-600">{session.varianceCount}</span>
                                            ) : session.countedCount > 0 ? (
                                                <span className="font-black text-emerald-600">0</span>
                                            ) : (
                                                <span className="text-zinc-300">&mdash;</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={`${cfg.bg} ${cfg.text} border-0 rounded-none text-[9px] font-black uppercase`}>{cfg.label}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {session.status !== "COMPLETED" && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-[9px] uppercase font-black border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-[1px] rounded-none"
                                                    onClick={() => handleOpenCount(session.id)}
                                                >
                                                    Hitung
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* CREATE SESSION DIALOG */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className={NB.content}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}><ClipboardList className="h-5 w-5" /> Sesi Stok Opname Baru</DialogTitle>
                        <p className={NB.subtitle}>Pilih gudang dan tanggal. Semua produk aktif di gudang akan otomatis ditambahkan.</p>
                    </DialogHeader>
                    <div className="p-5 space-y-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Gudang <span className="text-red-500">*</span></label>
                            <Select value={newWarehouseId} onValueChange={setNewWarehouseId}>
                                <SelectTrigger className="border-2 border-black font-bold h-10 rounded-none">
                                    <SelectValue placeholder="Pilih gudang..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map((w: any) => (
                                        <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Tanggal</label>
                            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="border-2 border-black font-mono h-10 rounded-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block">Catatan</label>
                            <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Opsional..." className="border-2 border-black h-10 rounded-none" />
                        </div>
                        <Button onClick={handleCreate} disabled={creating} className="w-full bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs h-10 rounded-none">
                            {creating ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                            Buat Sesi
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* COUNT DIALOG */}
            <Dialog open={!!countOpen} onOpenChange={(open) => !open && setCountOpen(null)}>
                <DialogContent className={`${NB.content} max-w-3xl max-h-[80vh] overflow-y-auto`}>
                    <DialogHeader className={NB.header}>
                        <DialogTitle className={NB.title}><ClipboardList className="h-5 w-5" /> Hitung Stok — {activeSession?.warehouseName}</DialogTitle>
                        <p className={NB.subtitle}>Isi jumlah aktual untuk setiap produk. Kosongkan jika belum dihitung.</p>
                    </DialogHeader>
                    <div className="p-5">
                        <Table>
                            <TableHeader className="bg-zinc-50 border-b-2 border-black">
                                <TableRow>
                                    <TableHead className="font-black text-black uppercase text-[10px] tracking-wider">Produk</TableHead>
                                    <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-right w-[100px]">Sistem</TableHead>
                                    <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-right w-[120px]">Aktual</TableHead>
                                    <TableHead className="font-black text-black uppercase text-[10px] tracking-wider text-center w-[80px]">Selisih</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {activeSession?.items.map((item) => {
                                    const actual = counts[item.id]
                                    const variance = actual !== undefined && actual !== "" ? Number(actual) - Number(item.expectedQty) : null
                                    return (
                                        <TableRow key={item.id} className="border-b border-zinc-100">
                                            <TableCell>
                                                <div className="font-bold text-sm">{item.productName}</div>
                                                <div className="text-[10px] font-mono text-zinc-400">{item.productCode} &middot; {item.unit}</div>
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-bold">{Number(item.expectedQty).toLocaleString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    value={counts[item.id] ?? ""}
                                                    onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                                    className="border-2 border-black font-mono font-bold h-8 text-right w-full rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    placeholder="—"
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {variance !== null ? (
                                                    <span className={`font-black ${variance === 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                        {variance > 0 ? "+" : ""}{variance}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-300">&mdash;</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                        <div className="flex gap-2 mt-4">
                            <Button
                                onClick={handleSubmitCounts}
                                disabled={submitting}
                                className="flex-1 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs h-10 rounded-none"
                            >
                                {submitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                Simpan Hitungan
                            </Button>
                            {activeSession && activeSession.countedCount === activeSession.itemCount && activeSession.status !== "COMPLETED" && (
                                <Button
                                    onClick={handleFinalize}
                                    disabled={finalizing}
                                    className="bg-emerald-600 text-white border-2 border-emerald-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs h-10 rounded-none px-6"
                                >
                                    {finalizing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                    Finalisasi
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
