"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createManualMovement } from "@/app/actions/inventory"
import { toast } from "sonner"
import { Loader2, ArrowRightLeft, Plus, Minus, Box, CheckCircle2 } from "lucide-react"

interface AdjustmentFormProps {
    products: { id: string, name: string, code: string, unit: string }[]
    warehouses: { id: string, name: string }[]
}

import { useRouter } from "next/navigation"

export function AdjustmentForm({ products, warehouses }: AdjustmentFormProps) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    // Form States
    const [type, setType] = useState<'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER'>('ADJUSTMENT_IN')
    const [productId, setProductId] = useState("")
    const [warehouseId, setWarehouseId] = useState("")
    const [targetWarehouseId, setTargetWarehouseId] = useState("")
    const [quantity, setQuantity] = useState("")
    const [reason, setReason] = useState("")
    const [notes, setNotes] = useState("")
    const [searchQuery, setSearchQuery] = useState("") // Move search query here to reset it too

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
                notes: reason ? `${reason} - ${notes}` : notes,
                userId: "system-user" // In a real app, get from session
            })

            if (result.success) {
                toast.success("Adjustment saved successfully!", {
                    description: "Inventory levels have been updated.",
                    className: "border-2 border-black bg-white text-green-700 font-bold"
                })

                // Reset ALL fields to blank state
                setProductId("")
                setWarehouseId("")
                setTargetWarehouseId("")
                setQuantity("")
                setReason("")
                setNotes("")
                setSearchQuery("") // Clear the search box visual text

                router.refresh()
            } else {
                toast.error("Failed to save adjustment", { description: ("error" in result && result.error) ? String(result.error) : "Unknown error" })
            }
        } catch {
            toast.error("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    const [openProduct, setOpenProduct] = useState(false)

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleSelectProduct = (product: { id: string, name: string, code: string }) => {
        setProductId(product.id)
        setSearchQuery(`${product.code} - ${product.name}`)
        setOpenProduct(false)
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label className="font-bold uppercase text-xs text-muted-foreground">Adjustment Type</Label>
                <Select value={type} onValueChange={(val: any) => setType(val)}>
                    <SelectTrigger className="h-12 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold text-base rounded-xl">
                        <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black font-bold" usePortal={false}>
                        <SelectItem value="ADJUSTMENT_IN">
                            <div className="flex items-center gap-2 text-emerald-700">
                                <Plus className="h-4 w-4" /> Stock IN (Addition)
                            </div>
                        </SelectItem>
                        <SelectItem value="ADJUSTMENT_OUT">
                            <div className="flex items-center gap-2 text-red-700">
                                <Minus className="h-4 w-4" /> Stock OUT (Reduction)
                            </div>
                        </SelectItem>
                        <SelectItem value="TRANSFER">
                            <div className="flex items-center gap-2 text-blue-700">
                                <ArrowRightLeft className="h-4 w-4" /> Transfer Warehouse
                            </div>
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>




            <div className="space-y-2 relative group">
                <Label className="font-bold uppercase text-xs text-muted-foreground">Product</Label>
                <div className="relative">
                    <Input
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value)
                            setOpenProduct(true)
                            if (productId) setProductId("") // Clear selection on edit
                        }}
                        onFocus={() => setOpenProduct(true)}
                        onBlur={() => setTimeout(() => setOpenProduct(false), 200)} // Delay to allow click
                        placeholder="Search Product Code or Name..."
                        className="h-12 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold text-base rounded-xl pr-10"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <Box className="h-5 w-5" />
                    </div>
                </div>

                {/* Suggestions Dropdown */}
                {openProduct && (
                    <div className="absolute top-[85px] left-0 w-full z-50 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-[300px] overflow-auto animate-in fade-in zoom-in-95 duration-100">
                        {filteredProducts.length === 0 ? (
                            <div className="p-4 text-sm text-center text-muted-foreground font-bold italic">
                                No products found. <br />
                                <span className="text-xs font-normal">Try a different name or code.</span>
                            </div>
                        ) : (
                            filteredProducts.map(p => (
                                <div
                                    key={p.id}
                                    onMouseDown={(e) => {
                                        e.preventDefault() // Prevent blur
                                        handleSelectProduct(p)
                                    }}
                                    className="p-3 hover:bg-zinc-100 cursor-pointer border-b last:border-0 border-black/10 flex items-center justify-between group/item transition-colors"
                                >
                                    <div>
                                        <div className="font-bold text-sm">{p.name}</div>
                                        <div className="text-xs text-muted-foreground font-mono font-bold">{p.code}</div>
                                    </div>
                                    {productId === p.id && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="font-bold uppercase text-xs text-muted-foreground">
                        {type === 'TRANSFER' ? 'From Warehouse' : 'Warehouse'}
                    </Label>
                    <Select value={warehouseId} onValueChange={setWarehouseId}>
                        <SelectTrigger className="h-12 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold rounded-xl">
                            <SelectValue placeholder="Select Source" />
                        </SelectTrigger>
                        <SelectContent className="border-2 border-black font-bold" usePortal={false}>
                            {warehouses.map(w => (
                                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {type === 'TRANSFER' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-left-2">
                        <Label className="font-bold uppercase text-xs text-muted-foreground">To Warehouse</Label>
                        <Select value={targetWarehouseId} onValueChange={setTargetWarehouseId}>
                            <SelectTrigger className="h-12 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold rounded-xl">
                                <SelectValue placeholder="Select Target" />
                            </SelectTrigger>
                            <SelectContent className="border-2 border-black font-bold" usePortal={false}>
                                {warehouses.filter(w => w.id !== warehouseId).map(w => (
                                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <Label className="font-bold uppercase text-xs text-muted-foreground">Amount</Label>
                <div className="relative">
                    <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0"
                        className="h-12 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-black text-lg rounded-xl pl-4"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        UNIT
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="font-bold uppercase text-xs text-muted-foreground">Reason</Label>
                <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Brief reason (e.g. Damage, Expired, Gift)"
                    className="h-12 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold rounded-xl"
                />
            </div>

            <div className="space-y-2">
                <Label className="font-bold uppercase text-xs text-muted-foreground">Additional Notes</Label>
                <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Details..."
                    className="min-h-[100px] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-bold rounded-xl resize-none"
                />
            </div>

            <Button
                onClick={handleSubmit}
                className="w-full h-14 bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all uppercase font-black tracking-wide text-lg rounded-xl mt-4"
                disabled={loading}
            >
                {loading ? <Loader2 className="animate-spin mr-2" /> : <Box className="mr-2 h-5 w-5" />}
                Save Adjustment
            </Button>
        </div>
    )
}
