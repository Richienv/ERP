"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { detectWorkOrderShortages, createPRFromWorkOrder } from "@/lib/actions/manufacturing-procurement"
import { IconAlertTriangle, IconCheck, IconLoader2 } from "@tabler/icons-react"

interface ShortageItem {
    materialId: string
    materialCode: string
    materialName: string
    unit: string
    requiredQty: number
    availableQty: number
    onOrderQty: number
    shortfall: number
    suppliers: Array<{ id: string; name: string }>
    preferredSupplierId: string | null
}

interface ShortageDialogProps {
    workOrderId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    onPRCreated?: () => void
}

export function ShortageDialog({ workOrderId, open, onOpenChange, onPRCreated }: ShortageDialogProps) {
    const [loading, setLoading] = useState(false)
    const [creating, setCreating] = useState(false)
    const [shortages, setShortages] = useState<ShortageItem[]>([])
    const [orderQtys, setOrderQtys] = useState<Record<string, number>>({})
    const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, string>>({})

    useEffect(() => {
        if (open && workOrderId) {
            setLoading(true)
            detectWorkOrderShortages(workOrderId)
                .then((data) => {
                    setShortages(data as ShortageItem[])
                    const qtys: Record<string, number> = {}
                    const suppliers: Record<string, string> = {}
                    for (const item of data as ShortageItem[]) {
                        qtys[item.materialId] = item.shortfall
                        if (item.preferredSupplierId) {
                            suppliers[item.materialId] = item.preferredSupplierId
                        }
                    }
                    setOrderQtys(qtys)
                    setSelectedSuppliers(suppliers)
                })
                .catch(() => toast.error("Gagal memuat data kekurangan"))
                .finally(() => setLoading(false))
        }
    }, [open, workOrderId])

    async function handleCreatePR() {
        setCreating(true)
        try {
            const items = shortages
                .filter((s) => (orderQtys[s.materialId] ?? 0) > 0)
                .map((s) => ({
                    materialId: s.materialId,
                    qty: orderQtys[s.materialId],
                    supplierId: selectedSuppliers[s.materialId],
                }))

            if (items.length === 0) {
                toast.error("Tidak ada item untuk dipesan")
                return
            }

            const result = await createPRFromWorkOrder(workOrderId, items)
            toast.success(`Purchase Request ${result.number} berhasil dibuat (${result.itemCount} item)`)
            onOpenChange(false)
            onPRCreated?.()
        } catch {
            toast.error("Gagal membuat Purchase Request")
        } finally {
            setCreating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconAlertTriangle className="h-5 w-5" />
                        Cek Kebutuhan Material
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">Memeriksa ketersediaan material...</span>
                    </div>
                ) : shortages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="rounded-full bg-green-100 p-3 mb-3">
                            <IconCheck className="h-8 w-8 text-green-600" />
                        </div>
                        <p className="text-lg font-semibold">Semua material tersedia!</p>
                        <p className="text-sm text-muted-foreground">Tidak ada kekurangan material untuk work order ini.</p>
                    </div>
                ) : (
                    <>
                        <div className="max-h-96 overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Material</TableHead>
                                        <TableHead className="text-right">Butuh</TableHead>
                                        <TableHead className="text-right">Stok</TableHead>
                                        <TableHead className="text-right">On Order</TableHead>
                                        <TableHead className="text-right">Kurang</TableHead>
                                        <TableHead>Supplier</TableHead>
                                        <TableHead className="text-right">Qty Pesan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shortages.map((item) => (
                                        <TableRow key={item.materialId}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{item.materialName}</p>
                                                    <p className="text-xs text-muted-foreground">{item.materialCode} · {item.unit}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">{item.requiredQty}</TableCell>
                                            <TableCell className="text-right">{item.availableQty}</TableCell>
                                            <TableCell className="text-right">{item.onOrderQty}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="destructive">{item.shortfall}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {item.suppliers.length > 0 ? (
                                                    <Select
                                                        value={selectedSuppliers[item.materialId] ?? ""}
                                                        onValueChange={(v) =>
                                                            setSelectedSuppliers((prev) => ({ ...prev, [item.materialId]: v }))
                                                        }
                                                    >
                                                        <SelectTrigger className="h-8 w-40">
                                                            <SelectValue placeholder="Pilih..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {item.suppliers.map((s) => (
                                                                <SelectItem key={s.id} value={s.id}>
                                                                    {s.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">Belum ada</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Input
                                                    type="number"
                                                    className="h-8 w-20 text-right"
                                                    value={orderQtys[item.materialId] ?? 0}
                                                    onChange={(e) =>
                                                        setOrderQtys((prev) => ({
                                                            ...prev,
                                                            [item.materialId]: parseInt(e.target.value) || 0,
                                                        }))
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Batal
                            </Button>
                            <Button
                                onClick={handleCreatePR}
                                disabled={creating}
                                className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                                {creating ? (
                                    <>
                                        <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Membuat...
                                    </>
                                ) : (
                                    "Buat Purchase Request"
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
