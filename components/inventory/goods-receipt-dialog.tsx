"use client"

import { useState, useEffect } from "react"
import { useForm, SubmitHandler } from "react-hook-form" // Added SubmitHandler
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
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
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { receiveGoodsFromPO } from "@/app/actions/inventory"
import { Loader2, PackagePlus, Truck, CheckCircle2, AlertTriangle, Box } from "lucide-react"

const formSchema = z.object({
    poId: z.string().min(1, "Purchase Order is required"),
    receivedQty: z.coerce.number().min(1, "Quantity must be at least 1"),
})

interface OpenPO {
    id: string
    number: string
    supplierName: string
    expectedDate: Date | null
    orderedQty: number
    receivedQty: number
    remainingQty: number
}

interface GoodsReceiptDialogProps {
    item: {
        id: string
        name: string
        unit: string
        warehouses: { id: string, name: string, qty: number }[]
    }
    openPOs: OpenPO[]
    defaultWarehouseId?: string
    onSuccess?: () => void
}

export function GoodsReceiptDialog({ item, openPOs, onSuccess }: GoodsReceiptDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [selectedPO, setSelectedPO] = useState<OpenPO | null>(null)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            poId: openPOs.length === 1 ? openPOs[0].id : "",
            receivedQty: openPOs.length === 1 ? openPOs[0].remainingQty : 0,
        },
    })

    // Auto-select the first PO when dialog opens
    useEffect(() => {
        if (open && openPOs.length > 0) {
            // Always default to the first PO to save clicks
            const defaultPO = openPOs[0]
            setSelectedPO(defaultPO)
            form.setValue("poId", defaultPO.id)
            form.setValue("receivedQty", defaultPO.remainingQty)
        }
    }, [open, openPOs, form])

    const handlePOSelect = (poId: string) => {
        const po = openPOs.find(p => p.id === poId)
        if (po) {
            setSelectedPO(po)
            form.setValue("receivedQty", po.remainingQty)
        }
    }

    const router = useRouter()

    const onSubmit: SubmitHandler<z.infer<typeof formSchema>> = async (values) => {
        if (!selectedPO) return

        setLoading(true)
        try {
            // Pass undefined for warehouseId to let server handle default fallback
            const result = await receiveGoodsFromPO({
                itemId: item.id,
                poId: values.poId,
                warehouseId: item.warehouses[0]?.id || "",
                receivedQty: values.receivedQty
            })

            if (result.success) {
                toast.success("Stock Received Successfully!", {
                    description: `Added ${values.receivedQty} ${item.unit} to inventory.`,
                    icon: <CheckCircle2 className="h-5 w-5 text-green-600" />
                })
                setOpen(false)
                form.reset()
                setSelectedPO(null)
                if (onSuccess) onSuccess()
                if (onSuccess) onSuccess()
                // router.refresh() // Optimized: Disabled to rely on Optimistic UI for instant feedback
            } else {
                toast.error(result.error)
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-bold uppercase text-xs h-8 gap-2">
                    <PackagePlus className="h-3.5 w-3.5" />
                    Receive Goods
                </Button>
            </DialogTrigger>

            {/* Larger Content Width */}
            <DialogContent className="sm:max-w-2xl border-none shadow-none bg-transparent p-0">

                {/* Creative Card Design */}
                <div className="bg-white border-[3px] border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] rounded-3xl overflow-hidden flex flex-col md:flex-row">

                    {/* Left Side: Visual / Info */}
                    <div className="bg-emerald-100 p-8 md:w-1/3 flex flex-col justify-between border-b-[3px] md:border-b-0 md:border-r-[3px] border-black">
                        <div>
                            <div className="bg-white w-16 h-16 rounded-2xl border-2 border-black flex items-center justify-center mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <Box className="h-8 w-8 text-black" />
                            </div>
                            <h2 className="text-2xl font-black uppercase text-black leading-none mb-2">Details</h2>
                            <p className="font-bold text-black/70 text-sm">Review the shipment details before accepting.</p>
                        </div>

                        <div className="mt-8 space-y-4">
                            <div className="bg-white/50 p-3 rounded-xl border-2 border-black/10">
                                <p className="text-[10px] font-bold uppercase text-black/50">Item Name</p>
                                <p className="font-black text-lg leading-tight">{item.name}</p>
                            </div>
                            <div className="bg-white/50 p-3 rounded-xl border-2 border-black/10">
                                <p className="text-[10px] font-bold uppercase text-black/50">Unit Type</p>
                                <p className="font-bold">{item.unit}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Form */}
                    <div className="p-8 md:w-2/3 bg-white">
                        <DialogHeader className="mb-6">
                            <DialogTitle className="text-3xl font-black uppercase flex items-center gap-3">
                                Confirm Receipt
                            </DialogTitle>
                            <DialogDescription className="font-medium text-black/60">
                                Select the Purchasing Order and verify the quantity.
                            </DialogDescription>
                        </DialogHeader>

                        {/* PO Selection Logic */}
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                                <div className="space-y-4">
                                    <FormField
                                        control={form.control as any}
                                        name="poId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-black text-sm uppercase">Source PO</FormLabel>
                                                <Select
                                                    onValueChange={(val) => { field.onChange(val); handlePOSelect(val) }}
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger className="h-12 border-2 border-black shadow-[4px_4px_0px_0px_#e5e7eb] focus:shadow-[4px_4px_0px_0px_black] transition-all rounded-xl font-bold bg-zinc-50">
                                                            <SelectValue placeholder="Select Purchase Order..." />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="border-2 border-black rounded-xl font-bold">
                                                        {openPOs.map(po => (
                                                            <SelectItem key={po.id} value={po.id}>
                                                                {po.number} — {po.supplierName}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/* Selected PO Summary Card */}
                                    {selectedPO && (
                                        <div className="bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl p-4 grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-blue-500">Supplier</p>
                                                <p className="font-bold text-sm truncate">{selectedPO.supplierName}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold uppercase text-blue-500">Ordered</p>
                                                <p className="font-bold text-sm">{selectedPO.orderedQty} {item.unit}</p>
                                            </div>
                                            <div className="col-span-2 pt-2 border-t border-blue-200 border-dashed flex justify-between items-center">
                                                <p className="font-bold text-blue-700 text-xs">Remaining Logic:</p>
                                                <Badge variant="secondary" className="bg-black text-white hover:bg-black">{selectedPO.remainingQty} Left</Badge>
                                            </div>
                                        </div>
                                    )}

                                    <FormField
                                        control={form.control as any}
                                        name="receivedQty"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-black text-sm uppercase">Received Quantity</FormLabel>
                                                <div className="relative">
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            {...field}
                                                            className="h-14 text-2xl font-black border-2 border-black rounded-xl pl-12 shadow-[4px_4px_0px_0px_#e5e7eb] focus:shadow-[4px_4px_0px_0px_black] transition-all"
                                                        />
                                                    </FormControl>
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-zinc-400 text-lg">
                                                        #
                                                    </div>
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-zinc-400 text-sm">
                                                        {item.unit}
                                                    </div>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <DialogFooter className="pt-2">
                                    <div className="flex gap-3 w-full">
                                        <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 h-12 border-2 border-black rounded-xl font-bold uppercase hover:bg-zinc-100">
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={loading} className="flex-[2] h-12 bg-black text-white hover:bg-zinc-800 border-2 border-black rounded-xl font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all">
                                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Receipt"}
                                        </Button>
                                    </div>
                                </DialogFooter>

                            </form>
                        </Form>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function Badge({ children, variant, className }: any) {
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${className}`}>{children}</span>
}
