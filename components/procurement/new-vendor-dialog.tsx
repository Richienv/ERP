"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Loader2, Truck, Building2, User, Mail, Phone, MapPin, Tag, X } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createVendor, getSupplierCategories, createSupplierCategory } from "@/app/actions/vendor"
import { NB } from "@/lib/dialog-styles"

const formSchema = z.object({
    code: z.string().min(1, "Vendor Code is required"),
    name: z.string().min(2, "Company Name must be at least 2 characters"),
    contactName: z.string().optional(),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    categoryIds: z.array(z.string()).optional(),
})

export function NewVendorDialog() {
    const [open, setOpen] = useState(false)
    const queryClient = useQueryClient()
    const [newCatName, setNewCatName] = useState("")
    const [creatingCat, setCreatingCat] = useState(false)

    const { data: categories = [] } = useQuery({
        queryKey: queryKeys.supplierCategories.list(),
        queryFn: () => getSupplierCategories(),
    })

    async function handleCreateCategory() {
        if (newCatName.trim().length < 2) return
        setCreatingCat(true)
        try {
            const result = await createSupplierCategory(newCatName.trim()) as any
            if (result.success && result.category) {
                queryClient.invalidateQueries({ queryKey: queryKeys.supplierCategories.all })
                const current = form.getValues("categoryIds") || []
                form.setValue("categoryIds", [...current, result.category.id])
                setNewCatName("")
                toast.success(`Kategori "${result.category.name}" berhasil dibuat`)
            } else {
                toast.error(result.error || "Gagal membuat kategori")
            }
        } catch {
            toast.error("Gagal membuat kategori")
        } finally {
            setCreatingCat(false)
        }
    }

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            code: "",
            name: "",
            contactName: "",
            email: "",
            phone: "",
            address: "",
            categoryIds: [],
        },
    })

    const { isSubmitting } = form.formState

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const result = await createVendor(values) as any

            if (result.success) {
                toast.success(result.message || "Vendor berhasil dibuat")
                setOpen(false)
                form.reset()
                queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.supplierCategories.all })
            } else {
                toast.error(result.error || "Gagal membuat vendor")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
            console.error(error)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className={NB.triggerBtn}>
                    <Plus className="mr-2 h-4 w-4" /> Vendor Baru
                </Button>
            </DialogTrigger>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Truck className="h-5 w-5" /> Tambah Vendor
                    </DialogTitle>
                    <p className={NB.subtitle}>Masukkan detail vendor baru untuk ditambahkan ke database</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">
                            {/* Identitas Vendor */}
                            <div className={NB.section}>
                                <div className={`${NB.sectionHead} border-l-4 border-l-violet-400 bg-violet-50`}>
                                    <Building2 className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Identitas Vendor</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="code"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <label className={NB.label}>Kode Vendor <span className={NB.labelRequired}>*</span></label>
                                                    <FormControl>
                                                        <Input placeholder="VND-001" {...field} className={NB.inputMono} />
                                                    </FormControl>
                                                    <FormMessage className={NB.error} />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="phone"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <label className={NB.label}><Phone className="h-3 w-3 inline mr-1" />Telepon</label>
                                                    <FormControl>
                                                        <Input placeholder="+62..." {...field} className={NB.input} />
                                                    </FormControl>
                                                    <FormMessage className={NB.error} />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <label className={NB.label}>Nama Perusahaan <span className={NB.labelRequired}>*</span></label>
                                                <FormControl>
                                                    <Input placeholder="PT..." {...field} className={NB.input} />
                                                </FormControl>
                                                <FormMessage className={NB.error} />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Kategori Pemasok */}
                            <div className={NB.section}>
                                <div className={`${NB.sectionHead} border-l-4 border-l-violet-400 bg-violet-50`}>
                                    <Tag className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Kategori Pemasok</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">
                                        Pilih jenis barang yang disuplai
                                    </p>
                                    {/* Selected tags */}
                                    <div className="flex flex-wrap gap-1.5 mb-3 min-h-[28px]">
                                        {(form.watch("categoryIds") || []).map((catId: string) => {
                                            const cat = categories.find((c: any) => c.id === catId)
                                            if (!cat) return null
                                            return (
                                                <span key={catId} className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 border border-violet-300 text-violet-800 text-xs font-bold rounded-sm">
                                                    {cat.name}
                                                    <button type="button" onClick={() => {
                                                        const current = form.getValues("categoryIds") || []
                                                        form.setValue("categoryIds", current.filter((id: string) => id !== catId))
                                                    }}>
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </span>
                                            )
                                        })}
                                    </div>
                                    {/* Category buttons */}
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {categories.map((cat: any) => {
                                            const selected = (form.watch("categoryIds") || []).includes(cat.id)
                                            return (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const current = form.getValues("categoryIds") || []
                                                        if (selected) {
                                                            form.setValue("categoryIds", current.filter((id: string) => id !== cat.id))
                                                        } else {
                                                            form.setValue("categoryIds", [...current, cat.id])
                                                        }
                                                    }}
                                                    className={`px-2.5 py-1 text-xs font-bold border-2 transition-all ${
                                                        selected
                                                            ? "border-violet-500 bg-violet-500 text-white"
                                                            : "border-zinc-200 bg-white text-zinc-600 hover:border-violet-300"
                                                    }`}
                                                >
                                                    {cat.name}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {/* Add new category inline */}
                                    <div className="flex gap-2">
                                        <Input
                                            value={newCatName}
                                            onChange={(e) => setNewCatName(e.target.value)}
                                            placeholder="Tambah kategori baru..."
                                            className={`${NB.input} flex-1 h-8 text-xs`}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault()
                                                    if (newCatName.trim().length >= 2) {
                                                        handleCreateCategory()
                                                    }
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={creatingCat || newCatName.trim().length < 2}
                                            onClick={handleCreateCategory}
                                            className="h-8 px-3 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold"
                                        >
                                            {creatingCat ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Kontak */}
                            <div className={NB.section}>
                                <div className={`${NB.sectionHead} border-l-4 border-l-violet-400 bg-violet-50`}>
                                    <User className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Kontak</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="contactName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <label className={NB.label}>Kontak Person</label>
                                                    <FormControl>
                                                        <Input placeholder="Bpk/Ibu..." {...field} className={NB.input} />
                                                    </FormControl>
                                                    <FormMessage className={NB.error} />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="email"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <label className={NB.label}><Mail className="h-3 w-3 inline mr-1" />Email</label>
                                                    <FormControl>
                                                        <Input placeholder="email@vendor.com" {...field} className={NB.input} />
                                                    </FormControl>
                                                    <FormMessage className={NB.error} />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Alamat */}
                            <div className={NB.section}>
                                <div className={`${NB.sectionHead} border-l-4 border-l-violet-400 bg-violet-50`}>
                                    <MapPin className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Alamat</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <FormField
                                        control={form.control}
                                        name="address"
                                        render={({ field }) => (
                                            <FormItem>
                                                <label className={NB.label}>Alamat Lengkap</label>
                                                <FormControl>
                                                    <Textarea placeholder="Alamat lengkap..." {...field} className={NB.textarea} />
                                                </FormControl>
                                                <FormMessage className={NB.error} />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className={NB.footer}>
                                <Button type="button" variant="outline" onClick={() => setOpen(false)} className={NB.cancelBtn}>
                                    Batal
                                </Button>
                                <Button type="submit" disabled={isSubmitting} className={NB.submitBtn}>
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        "Simpan Vendor"
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
