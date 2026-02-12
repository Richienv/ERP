"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createManualMovement } from "@/app/actions/inventory"
import { toast } from "sonner"
import { Loader2, ArrowRightLeft, Plus, Minus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface ManualMovementDialogProps {
    products: { id: string, name: string, code: string }[]
    warehouses: { id: string, name: string }[]
    userId?: string
}

export function ManualMovementDialog({ products, warehouses, userId = "system-user" }: ManualMovementDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const [type, setType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER' | 'SCRAP'>('ADJUSTMENT_IN')
    const [productId, setProductId] = useState("")
    const [warehouseId, setWarehouseId] = useState("")
    const [targetWarehouseId, setTargetWarehouseId] = useState("")
    const [quantity, setQuantity] = useState("")
    const [notes, setNotes] = useState("")

    const handleSubmit = async () => {
        if (!productId || !warehouseId || !quantity) {
            toast.error("Please fill in all required fields")
            return
        }

        if (type === 'TRANSFER' && !targetWarehouseId) {
            toast.error("Please select a target warehouse")
            return
        }

        if (type === 'TRANSFER' && warehouseId === targetWarehouseId) {
            toast.error("Source and Target warehouse cannot be the same")
            return
        }

        setLoading(true)
        try {
            const result = await createManualMovement({
                type,
                productId,
                warehouseId,
                targetWarehouseId: type === 'TRANSFER' ? targetWarehouseId : undefined,
                quantity: Number(quantity),
                notes,
                userId
            })

            if (result.success) {
                toast.success("Movement recorded successfully")
                setOpen(false)
                // Reset form
                setQuantity("")
                setNotes("")
                router.refresh()
            } else {
                toast.error(("error" in result && result.error) ? String(result.error) : "Failed to record movement")
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-white text-black hover:bg-zinc-100 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-black tracking-wide transition-all active:translate-y-1 active:shadow-none active:border-black">
                    <ArrowRightLeft className="mr-2 h-4 w-4" /> Manual Movement
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <DialogHeader>
                    <DialogTitle className="font-black text-xl uppercase tracking-tight">Record Stock Movement</DialogTitle>
                    <DialogDescription>
                        Manually adjust stock levels or transfer items between warehouses.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right font-bold">Type</Label>
                        <Select value={type} onValueChange={(val: any) => setType(val)}>
                            <SelectTrigger className="col-span-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">
                                <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent className="border-2 border-black" usePortal={false}>
                                <SelectItem value="ADJUSTMENT_IN" className="font-bold">
                                    <div className="flex items-center gap-2 text-emerald-700">
                                        <Plus className="h-4 w-4" /> Adjustment IN (Found Stock)
                                    </div>
                                </SelectItem>
                                <SelectItem value="ADJUSTMENT_OUT" className="font-bold">
                                    <div className="flex items-center gap-2 text-amber-700">
                                        <Minus className="h-4 w-4" /> Adjustment OUT (Loss/Correction)
                                    </div>
                                </SelectItem>
                                <SelectItem value="TRANSFER" className="font-bold">
                                    <div className="flex items-center gap-2 text-blue-700">
                                        <ArrowRightLeft className="h-4 w-4" /> Transfer
                                    </div>
                                </SelectItem>
                                <SelectItem value="SCRAP" className="font-bold">
                                    <div className="flex items-center gap-2 text-red-700">
                                        <Trash2 className="h-4 w-4" /> Scrap / Damage
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="product" className="text-right font-bold">Product</Label>
                        <Select value={productId} onValueChange={setProductId}>
                            <SelectTrigger className="col-span-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                <SelectValue placeholder="Select Product" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px] border-2 border-black" usePortal={false}>
                                {products.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                        <span className="font-bold">{p.code}</span> - {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="warehouse" className="text-right font-bold">
                            {type === 'TRANSFER' ? 'From' : 'Warehouse'}
                        </Label>
                        <Select value={warehouseId} onValueChange={setWarehouseId}>
                            <SelectTrigger className="col-span-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                <SelectValue placeholder="Select Source Warehouse" />
                            </SelectTrigger>
                            <SelectContent className="border-2 border-black">
                                {warehouses.map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {type === 'TRANSFER' && (
                        <div className="grid grid-cols-4 items-center gap-4 animate-in slide-in-from-top-2 fade-in duration-300">
                            <Label htmlFor="target" className="text-right font-bold">To</Label>
                            <Select value={targetWarehouseId} onValueChange={setTargetWarehouseId}>
                                <SelectTrigger className="col-span-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                    <SelectValue placeholder="Select Target Warehouse" />
                                </SelectTrigger>
                                <SelectContent className="border-2 border-black" usePortal={false}>
                                    {warehouses.filter(w => w.id !== warehouseId).map(w => (
                                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="quantity" className="text-right font-bold">Quantity</Label>
                        <Input
                            id="quantity"
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="col-span-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono font-bold"
                            placeholder="0"
                        />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="notes" className="text-right font-bold">Notes</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="col-span-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            placeholder="Reason for movement..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} className="border-2 border-black font-bold">Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-black text-white hover:bg-zinc-800 font-bold uppercase disabled:opacity-50">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Movement
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
