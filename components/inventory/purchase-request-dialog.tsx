"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { requestPurchase } from "@/app/actions/inventory"
import { Loader2, ShoppingBag, FileText, MapPin, Tag, CreditCard, Box } from "lucide-react"

// Formatting helper
const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

const formSchema = z.object({
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
    notes: z.string().optional(),
})

interface PurchaseRequestDialogProps {
    item: {
        id: string
        name: string
        sku: string
        category: string
        unit: string
        cost: number
        gap: number
        reorderPoint: number
    }
    onSuccess?: (newPO: any) => void
}

export function PurchaseRequestDialog({ item, onSuccess }: PurchaseRequestDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Default quantity logic: Gap or Reorder Point or 10
    const defaultQty = item.gap > 0 ? item.gap : (item.reorderPoint > 0 ? item.reorderPoint : 10)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            quantity: defaultQty,
            notes: "",
        },
    })

    const router = useRouter()

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true)
        try {
            const result = await requestPurchase({
                itemId: item.id,
                quantity: values.quantity,
                notes: values.notes
            })

            if (result.success) {
                console.log("[PurchaseRequestDialog] Success!", result)
                toast.success("Purchase Request Sent", {
                    description: `Requested ${values.quantity} ${item.unit} for ${item.name}`
                })
                setOpen(false)
                form.reset()
                if (onSuccess) {
                    // Support both old flow (newPO) and new flow (pendingTask)
                    const callbackData = result.pendingTask ? { pendingTask: result.pendingTask } : { newPO: result.newPO };
                    console.log("[PurchaseRequestDialog] Calling onSuccess with:", callbackData)
                    onSuccess(callbackData)
                } else {
                    console.warn("[PurchaseRequestDialog] onSuccess missing")
                }
                // router.refresh() // Optimized: Disabled to rely on Optimistic UI for instant feedback
            } else {
                toast.error(result.error || "Failed to request")
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
                <Button
                    size="sm"
                    className="bg-white text-black hover:bg-amber-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-bold uppercase text-xs h-8 gap-2"
                >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Request Purchase
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-xl border-none shadow-none bg-transparent p-0">

                {/* Creative Card Design */}
                <div className="bg-white border-[3px] border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] rounded-3xl overflow-hidden">

                    <DialogHeader className="p-6 pb-2 border-b-2 border-dashed border-zinc-200">
                        <DialogTitle className="text-2xl font-black uppercase flex items-center gap-3">
                            <FileText className="h-6 w-6" />
                            Submit Purchase Request
                        </DialogTitle>
                        <DialogDescription className="font-medium text-black/60">
                            Create a formal request for the purchasing department.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 bg-zinc-50/50">
                        {/* Information Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            {/* Product Info */}
                            <div className="col-span-2 bg-white border-2 border-black rounded-xl p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-start gap-4">
                                <div className="h-12 w-12 bg-black text-white rounded-lg flex items-center justify-center shrink-0">
                                    <Box className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-black/50 tracking-wider">Product</p>
                                    <h3 className="text-lg font-black leading-tight">{item.name}</h3>
                                    <p className="text-sm font-bold text-black/60 font-mono">{item.sku}</p>
                                </div>
                            </div>

                            {/* Category */}
                            <div className="bg-white border-2 border-zinc-200 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Tag className="h-3.5 w-3.5 text-zinc-400" />
                                    <p className="text-[10px] font-bold uppercase text-black/50">Category</p>
                                </div>
                                <p className="font-bold">{item.category || "Uncategorized"}</p>
                            </div>

                            {/* Estimated Cost */}
                            <div className="bg-white border-2 border-zinc-200 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <CreditCard className="h-3.5 w-3.5 text-zinc-400" />
                                    <p className="text-[10px] font-bold uppercase text-black/50">Est. Unit Price</p>
                                </div>
                                <p className="font-bold">{formatCurrency(item.cost)}</p>
                            </div>

                            {/* Warehouse Destination (Mock/Default) */}
                            <div className="col-span-2 bg-blue-50 border-2 border-blue-200 border-dashed rounded-xl p-3 flex items-center gap-3">
                                <MapPin className="h-5 w-5 text-blue-600" />
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-blue-500">Destination Warehouse</p>
                                    <p className="font-bold text-sm">Gudang Bahan Baku (Default)</p>
                                </div>
                            </div>
                        </div>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control as any}
                                        name="quantity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-black text-xs uppercase">Quantity Needed ({item.unit})</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        {...field}
                                                        className="font-bold border-2 border-black rounded-xl h-12"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex flex-col justify-end pb-2">
                                        <div className="text-xs font-bold text-black/50">
                                            Est. Total: <span className="text-black">{formatCurrency(form.getValues('quantity') * item.cost)}</span>
                                        </div>
                                    </div>
                                </div>

                                <FormField
                                    control={form.control as any}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-black text-xs uppercase">Notes for Purchasing</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    {...field}
                                                    placeholder="E.g., Urgent for next week production..."
                                                    className="font-medium border-2 border-black rounded-xl resize-none"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <DialogFooter className="pt-4">

                                    <Button type="submit" disabled={loading} className="h-12 flex-1 bg-black text-white hover:bg-zinc-800 border-2 border-black rounded-xl font-bold uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all">
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Confirm Request"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
