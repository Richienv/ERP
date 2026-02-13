"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, Plus, Loader2, UserCheck, StickyNote, Package, Save } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { createPurchaseRequest } from "@/lib/actions/procurement"

const itemSchema = z.object({
    productId: z.string().min(1, "Product is required"),
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
    notes: z.string().optional()
})

const formSchema = z.object({
    requesterId: z.string().min(1, "Requester is required"),
    department: z.string().optional(),
    priority: z.string().default("NORMAL"),
    notes: z.string().optional(),
    items: z.array(itemSchema).min(1, "At least one item is required")
})

type FormValues = z.infer<typeof formSchema>

interface Props {
    products: { id: string, name: string, unit: string, code: string }[]
    employees: { id: string, firstName: string, lastName: string | null, department: string }[]
}

export function CreateRequestForm({ products, employees }: Props) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const [newItem, setNewItem] = useState<{ productId: string, quantity: number, notes: string }>({
        productId: "",
        quantity: 1,
        notes: ""
    })

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            requesterId: "",
            priority: "NORMAL",
            notes: "",
            items: []
        }
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

        if (items.some(i => i.productId === newItem.productId)) {
            toast.error("Item sudah ditambahkan")
            return
        }

        form.setValue("items", [...items, newItem])
        setNewItem({ productId: "", quantity: 1, notes: "" })
    }

    const handleRemoveItem = (index: number) => {
        const current = form.getValues("items")
        form.setValue("items", current.filter((_, i) => i !== index))
    }

    const onSubmit = async (values: FormValues) => {
        setIsSubmitting(true)
        try {
            const result = await createPurchaseRequest(values)
            if (result.success) {
                toast.success("Purchase Request berhasil dibuat")
                router.push("/procurement/requests")
                router.refresh()
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

    const selectedProduct = products.find(p => p.id === newItem.productId)

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                {/* ================================================================== */}
                {/* SECTION 1 — Detail Permintaan                                      */}
                {/* ================================================================== */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="bg-violet-50 dark:bg-violet-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-violet-400">
                        <UserCheck className="h-4 w-4 text-violet-600" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Detail Permintaan</h3>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <FormField
                                control={form.control}
                                name="requesterId"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pemohon (Staff) *</Label>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="border-2 border-black h-10 font-medium">
                                                    <SelectValue placeholder="Pilih staff..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {employees.map(emp => (
                                                    <SelectItem key={emp.id} value={emp.id}>
                                                        {emp.firstName} {emp.lastName} <span className="text-zinc-400">({emp.department})</span>
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
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Prioritas</Label>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="border-2 border-black h-10 font-medium">
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
                    </div>
                </div>

                {/* ================================================================== */}
                {/* SECTION 2 — Catatan                                                */}
                {/* ================================================================== */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="bg-violet-50 dark:bg-violet-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-violet-400">
                        <StickyNote className="h-4 w-4 text-violet-600" />
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Catatan</h3>
                    </div>
                    <div className="p-5">
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Catatan Tambahan</Label>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Konteks tambahan (mis. nama proyek, alasan kebutuhan)..."
                                            className="border-2 border-black min-h-[80px] resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                {/* ================================================================== */}
                {/* SECTION 3 — Item Permintaan                                        */}
                {/* ================================================================== */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="bg-violet-50 dark:bg-violet-950/20 px-5 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-violet-400">
                        <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-violet-600" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Item Permintaan</h3>
                            <span className="bg-violet-500 text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center rounded-sm">
                                {items.length}
                            </span>
                        </div>
                    </div>

                    {/* Add Item Bar */}
                    <div className="p-4 bg-violet-50/50 dark:bg-violet-950/10 border-b-2 border-black">
                        <div className="flex flex-col md:flex-row gap-3 items-end">
                            <div className="flex-1 w-full space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Produk</Label>
                                <Select
                                    value={newItem.productId}
                                    onValueChange={(val) => setNewItem({ ...newItem, productId: val })}
                                >
                                    <SelectTrigger className="border-2 border-black h-10 font-medium bg-white">
                                        <SelectValue placeholder="Pilih produk..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products.map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                                <span className="font-mono text-xs text-zinc-400 mr-1">{p.code}</span> {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="w-24 space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Qty</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    className="border-2 border-black h-10 font-bold text-center bg-white"
                                    value={newItem.quantity}
                                    onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="text-sm min-w-[50px] h-10 flex items-center font-mono text-zinc-400 font-bold">
                                {selectedProduct?.unit || '-'}
                            </div>
                            <Button
                                type="button"
                                onClick={handleAddItem}
                                className="bg-violet-500 text-white hover:bg-violet-600 border-2 border-violet-600 text-[10px] font-black uppercase tracking-wide h-10 px-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
                            </Button>
                        </div>
                    </div>

                    {/* Items List */}
                    {items.length > 0 ? (
                        <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                            {items.map((item, index) => {
                                const p = products.find(x => x.id === item.productId)
                                return (
                                    <div key={index} className={`p-4 flex items-center gap-3 ${index % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-800/30"}`}>
                                        <div className="flex-none w-7 h-7 bg-violet-100 dark:bg-violet-900/30 border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 flex items-center justify-center text-xs font-black rounded-sm">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{p?.name}</div>
                                            <div className="text-xs font-mono text-zinc-400">{p?.code}</div>
                                        </div>
                                        <div className="h-10 bg-violet-50 dark:bg-violet-950/20 border-2 border-violet-300 dark:border-violet-700 flex items-center px-4 font-black text-sm font-mono text-violet-900 dark:text-violet-200 rounded-sm">
                                            {item.quantity} {p?.unit}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
                                            onClick={() => handleRemoveItem(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                            Belum ada item ditambahkan
                        </div>
                    )}
                </div>

                {/* Submit Bar */}
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="p-5 flex items-center justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push("/procurement/requests")}
                            className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-xs tracking-wide h-11 px-6 hover:border-zinc-500 transition-colors"
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || items.length === 0}
                            className="bg-violet-500 text-white hover:bg-violet-600 border-2 border-violet-600 font-black uppercase text-xs tracking-wide h-11 px-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] transition-all active:scale-[0.98]"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengirim...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" /> Submit Request
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </Form>
    )
}
