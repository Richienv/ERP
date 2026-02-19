"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Loader2, Trash2, Save, ClipboardList, Package } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
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
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createPurchaseRequest } from "@/lib/actions/procurement"
import { getEmployees } from "@/app/actions/hcm"
import { NB } from "@/lib/dialog-styles"

const itemSchema = z.object({
    productId: z.string().min(1, "Produk wajib dipilih"),
    quantity: z.coerce.number().min(1, "Qty minimal 1"),
    notes: z.string().optional(),
})

const formSchema = z.object({
    requesterId: z.string().min(1, "Pemohon wajib dipilih"),
    department: z.string().optional(),
    priority: z.string().default("NORMAL"),
    notes: z.string().optional(),
    items: z.array(itemSchema).min(1, "Minimal 1 item"),
})

type FormValues = z.infer<typeof formSchema>

export function NewPRDialog() {
    const [open, setOpen] = useState(false)
    const queryClient = useQueryClient()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [newItem, setNewItem] = useState({ productId: "", quantity: 1, notes: "" })

    // Fetch products + employees when dialog opens
    const { data: formData } = useQuery({
        queryKey: queryKeys.procurementRequestForm.list(),
        queryFn: async () => {
            const [productsRes, employees] = await Promise.all([
                fetch("/api/inventory/page-data").then(r => r.json()),
                getEmployees({ includeInactive: false }),
            ])
            return {
                products: (productsRes.products ?? []).map((p: any) => ({
                    id: p.id, name: p.name, unit: p.unit, code: p.code,
                })),
                employees: (employees ?? []).map((e: any) => ({
                    id: e.id, firstName: e.firstName, lastName: e.lastName, department: e.department,
                })),
            }
        },
    })

    const products = formData?.products ?? []
    const employees = formData?.employees ?? []

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            requesterId: "",
            priority: "NORMAL",
            notes: "",
            items: [],
        },
    })

    const items = form.watch("items")

    const handleAddItem = () => {
        if (!newItem.productId) {
            toast.error("Pilih produk terlebih dahulu")
            return
        }
        if (newItem.quantity < 1) {
            toast.error("Jumlah harus lebih dari 0")
            return
        }
        if (items.some((i) => i.productId === newItem.productId)) {
            toast.error("Item sudah ditambahkan")
            return
        }
        form.setValue("items", [...items, newItem])
        setNewItem({ productId: "", quantity: 1, notes: "" })
    }

    const handleRemoveItem = (index: number) => {
        form.setValue("items", form.getValues("items").filter((_, i) => i !== index))
    }

    const onSubmit = async (values: FormValues) => {
        setIsSubmitting(true)
        try {
            const result = await createPurchaseRequest(values)
            if (result.success) {
                toast.success("Purchase Request berhasil dibuat")
                queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
                form.reset()
                setNewItem({ productId: "", quantity: 1, notes: "" })
                setOpen(false)
            } else {
                toast.error(result.error || "Gagal membuat request")
            }
        } catch (error) {
            toast.error("Terjadi kesalahan")
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const selectedProduct = products.find((p: any) => p.id === newItem.productId)

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); setNewItem({ productId: "", quantity: 1, notes: "" }) } }}>
            <DialogTrigger asChild>
                <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 text-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black text-xs uppercase tracking-widest">
                    <Plus className="h-4 w-4" />
                    Buat PR Baru
                </button>
            </DialogTrigger>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className="bg-black text-white px-6 py-4">
                    <DialogTitle className={NB.title}>
                        <ClipboardList className="h-5 w-5 text-amber-400" />
                        Buat Permintaan Baru
                    </DialogTitle>
                    <p className={NB.subtitle}>Draft Purchase Request untuk pengadaan barang</p>
                </DialogHeader>

                <ScrollArea className="max-h-[70vh]">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-0">
                            {/* DETAIL PERMINTAAN */}
                            <div className="border-b-2 border-black">
                                <div className="bg-amber-50 px-4 py-2 border-b-2 border-black flex items-center gap-2 border-l-4 border-l-amber-400">
                                    <span className="text-xs font-black uppercase tracking-widest">Detail Permintaan</span>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="requesterId"
                                            render={({ field }) => (
                                                <FormItem className="space-y-1.5">
                                                    <label className={NB.label}>
                                                        Pemohon (Staff) <span className={NB.labelRequired}>*</span>
                                                    </label>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className={NB.select}>
                                                                <SelectValue placeholder="Pilih staff..." />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {employees.map((emp: any) => (
                                                                <SelectItem key={emp.id} value={emp.id}>
                                                                    {emp.firstName} {emp.lastName}{" "}
                                                                    <span className="text-zinc-400">({emp.department})</span>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="priority"
                                            render={({ field }) => (
                                                <FormItem className="space-y-1.5">
                                                    <label className={NB.label}>Prioritas</label>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className={NB.select}>
                                                                <SelectValue placeholder="Pilih prioritas..." />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="LOW">Low</SelectItem>
                                                            <SelectItem value="NORMAL">Normal</SelectItem>
                                                            <SelectItem value="HIGH">High</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <FormField
                                            control={form.control}
                                            name="notes"
                                            render={({ field }) => (
                                                <FormItem className="space-y-1.5">
                                                    <label className={NB.label}>Catatan (opsional)</label>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Konteks tambahan (mis. nama proyek, alasan kebutuhan)..."
                                                            className={NB.textarea + " min-h-[60px]"}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ITEM PERMINTAAN */}
                            <div>
                                <div className="bg-amber-50 px-4 py-2 border-b-2 border-black flex items-center gap-2 border-l-4 border-l-amber-400 justify-between">
                                    <div className="flex items-center gap-2">
                                        <Package className="h-4 w-4 text-amber-600" />
                                        <span className="text-xs font-black uppercase tracking-widest">Item Permintaan</span>
                                        <span className="bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center">
                                            {items.length}
                                        </span>
                                    </div>
                                </div>

                                {/* Add item bar */}
                                <div className="p-4 bg-amber-50/30 border-b-2 border-black">
                                    <div className="flex flex-col md:flex-row gap-3 items-end">
                                        <div className="flex-1 w-full space-y-1.5">
                                            <label className={NB.label}>Produk</label>
                                            <Select value={newItem.productId} onValueChange={(val) => setNewItem({ ...newItem, productId: val })}>
                                                <SelectTrigger className={NB.select + " bg-white"}>
                                                    <SelectValue placeholder="Pilih produk..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {products.map((p: any) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            <span className="font-mono text-xs text-zinc-400 mr-1">{p.code}</span> {p.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-24 space-y-1.5">
                                            <label className={NB.label}>Qty</label>
                                            <Input
                                                type="number"
                                                min={1}
                                                className={NB.inputMono + " text-center bg-white"}
                                                value={newItem.quantity}
                                                onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                                            />
                                        </div>
                                        <div className="text-sm min-w-[40px] h-10 flex items-center font-mono text-zinc-400 font-bold">
                                            {(selectedProduct as any)?.unit || "-"}
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={handleAddItem}
                                            className="bg-amber-500 text-black hover:bg-amber-600 border-2 border-black text-[10px] font-black uppercase tracking-wide h-10 px-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                                        >
                                            <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
                                        </Button>
                                    </div>
                                </div>

                                {/* Items list */}
                                {items.length > 0 ? (
                                    <div className="divide-y divide-zinc-200">
                                        {items.map((item, index) => {
                                            const p = products.find((x: any) => x.id === item.productId)
                                            return (
                                                <div
                                                    key={index}
                                                    className={`px-4 py-3 flex items-center gap-3 ${index % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}
                                                >
                                                    <div className="flex-none w-6 h-6 bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center text-[10px] font-black">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm truncate">{(p as any)?.name}</div>
                                                        <div className="text-[10px] font-mono text-zinc-400">{(p as any)?.code}</div>
                                                    </div>
                                                    <div className="h-8 bg-amber-50 border border-amber-300 flex items-center px-3 font-black text-xs font-mono text-amber-900">
                                                        {item.quantity} {(p as any)?.unit}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="h-8 w-8 flex items-center justify-center border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                                                        onClick={() => handleRemoveItem(index)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                        Belum ada item ditambahkan
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t-2 border-black bg-zinc-50">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setOpen(false)}
                                    className={NB.cancelBtn}
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || items.length === 0}
                                    className="bg-amber-400 text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-8 h-9 rounded-none"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim...</>
                                    ) : (
                                        <><Save className="mr-2 h-4 w-4" /> Submit Request</>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
