"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Trash2, ClipboardList, Package } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBSelect,
    NBTextarea,
} from "@/components/ui/nb-dialog"
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
        <>
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-400 text-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black text-xs uppercase tracking-widest"
            >
                <Plus className="h-4 w-4" />
                Buat PR Baru
            </button>

            <NBDialog
                open={open}
                onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); setNewItem({ productId: "", quantity: 1, notes: "" }) } }}
                size="default"
            >
                <NBDialogHeader
                    icon={ClipboardList}
                    title="Buat Permintaan Baru"
                    subtitle="Draft Purchase Request untuk pengadaan barang"
                />

                <NBDialogBody>
                    <Form {...form}>
                        <form id="new-pr-form" onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-3">
                            {/* DETAIL PERMINTAAN */}
                            <NBSection icon={ClipboardList} title="Detail Permintaan">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <FormField
                                        control={form.control}
                                        name="requesterId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <NBSelect
                                                    label="Pemohon (Staff)"
                                                    required
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    placeholder="Pilih staff..."
                                                    options={employees.map((emp: any) => ({
                                                        value: emp.id,
                                                        label: `${emp.firstName} ${emp.lastName} (${emp.department})`,
                                                    }))}
                                                />
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="priority"
                                        render={({ field }) => (
                                            <FormItem>
                                                <NBSelect
                                                    label="Prioritas"
                                                    value={field.value}
                                                    onValueChange={field.onChange}
                                                    placeholder="Pilih prioritas..."
                                                    options={[
                                                        { value: "LOW", label: "Low" },
                                                        { value: "NORMAL", label: "Normal" },
                                                        { value: "HIGH", label: "High" },
                                                    ]}
                                                />
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <NBTextarea
                                                label="Catatan"
                                                value={field.value ?? ""}
                                                onChange={field.onChange}
                                                placeholder="Konteks tambahan (mis. nama proyek, alasan kebutuhan)..."
                                                rows={2}
                                            />
                                        </FormItem>
                                    )}
                                />
                            </NBSection>

                            {/* ITEM PERMINTAAN */}
                            <NBSection icon={Package} title="Item Permintaan">
                                {/* Add item bar */}
                                <div className="flex flex-col md:flex-row gap-3 items-end">
                                    <div className="flex-1 w-full">
                                        <NBSelect
                                            label="Produk"
                                            value={newItem.productId}
                                            onValueChange={(val) => setNewItem({ ...newItem, productId: val })}
                                            placeholder="Pilih produk..."
                                            options={products.map((p: any) => ({
                                                value: p.id,
                                                label: `${p.code} ${p.name}`,
                                            }))}
                                        />
                                    </div>
                                    <div className="w-24 space-y-1">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">Qty</label>
                                        <Input
                                            type="number"
                                            min={1}
                                            className={NB.inputMono + " text-center bg-white"}
                                            value={newItem.quantity}
                                            onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="text-sm min-w-[40px] h-8 flex items-center font-mono text-zinc-400 font-bold">
                                        {(selectedProduct as any)?.unit || "-"}
                                    </div>
                                    <Button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="bg-black text-white hover:bg-zinc-800 border border-black text-[10px] font-black uppercase tracking-wide h-8 px-4 rounded-none transition-all"
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
                                    </Button>
                                </div>

                                {/* Items list */}
                                {items.length > 0 ? (
                                    <div className="divide-y divide-zinc-200 border border-zinc-200 dark:border-zinc-700">
                                        {items.map((item, index) => {
                                            const p = products.find((x: any) => x.id === item.productId)
                                            return (
                                                <div
                                                    key={index}
                                                    className={`px-3 py-2.5 flex items-center gap-3 ${index % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}`}
                                                >
                                                    <div className="flex-none w-6 h-6 bg-zinc-100 border border-zinc-300 text-zinc-600 flex items-center justify-center text-[10px] font-black">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-sm truncate">{(p as any)?.name}</div>
                                                        <div className="text-[10px] font-mono text-zinc-400">{(p as any)?.code}</div>
                                                    </div>
                                                    <div className="h-7 bg-orange-50 border border-orange-300 flex items-center px-3 font-black text-xs font-mono text-orange-900">
                                                        {item.quantity} {(p as any)?.unit}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="h-7 w-7 flex items-center justify-center border border-red-300 text-red-500 hover:bg-red-50 transition-colors"
                                                        onClick={() => handleRemoveItem(index)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                                        Belum ada item ditambahkan
                                    </div>
                                )}
                            </NBSection>
                        </form>
                    </Form>
                </NBDialogBody>

                <NBDialogFooter
                    onCancel={() => setOpen(false)}
                    onSubmit={() => form.handleSubmit(onSubmit as any)()}
                    submitting={isSubmitting}
                    submitLabel="Submit Request"
                    disabled={items.length === 0}
                />
            </NBDialog>
        </>
    )
}
