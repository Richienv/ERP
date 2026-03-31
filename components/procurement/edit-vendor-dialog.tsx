"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Truck, Building2, User, Mail, Phone, MapPin, Tag, X, CreditCard, PhoneCall, Plus } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"
import { usePaymentTerms } from "@/hooks/use-payment-terms"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
} from "@/components/ui/nb-dialog"
import { updateVendor, getSupplierCategories, createSupplierCategory } from "@/app/actions/vendor"
import { NB } from "@/lib/dialog-styles"


const BANK_OPTIONS = [
    { value: "BCA", label: "Bank Central Asia (BCA)" },
    { value: "MANDIRI", label: "Bank Mandiri" },
    { value: "BNI", label: "Bank Negara Indonesia (BNI)" },
    { value: "BRI", label: "Bank Rakyat Indonesia (BRI)" },
    { value: "CIMB", label: "CIMB Niaga" },
    { value: "BSI", label: "Bank Syariah Indonesia (BSI)" },
    { value: "BTN", label: "Bank Tabungan Negara (BTN)" },
    { value: "DANAMON", label: "Bank Danamon" },
    { value: "PERMATA", label: "Bank Permata" },
    { value: "MAYBANK", label: "Maybank Indonesia" },
] as const

const CONTACT_TITLE_OPTIONS = ["Bpk", "Ibu", "Dr", "Ir"] as const

const formSchema = z.object({
    code: z.string().min(1, "Vendor Code is required"),
    name: z.string().min(2, "Company Name must be at least 2 characters"),
    contactTitle: z.string().optional(),
    contactName: z.string().optional(),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    phone: z.string().optional(),
    picPhone: z.string().optional(),
    address: z.string().optional(),
    address2: z.string().optional(),
    officePhone: z.string().optional(),
    paymentTerm: z.string().optional(),
    categoryIds: z.array(z.string()).optional(),
    bankName: z.string().optional(),
    bankAccountNumber: z.string().optional(),
    bankAccountName: z.string().optional(),
})

interface EditVendorDialogProps {
    vendor: {
        id: string
        code: string
        name: string
        contactName: string | null
        contactTitle: string | null
        email: string | null
        phone: string | null
        picPhone: string | null
        officePhone: string | null
        address: string | null
        address2: string | null
        paymentTerm: string | null
        bankName: string | null
        bankAccountNumber: string | null
        bankAccountName: string | null
        categories: { id: string; code: string; name: string }[]
    }
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EditVendorDialog({ vendor, open, onOpenChange }: EditVendorDialogProps) {
    const queryClient = useQueryClient()
    const { data: paymentTermOptions = [] } = usePaymentTerms()
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
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            code: vendor.code,
            name: vendor.name,
            contactTitle: vendor.contactTitle || "",
            contactName: vendor.contactName || "",
            email: vendor.email || "",
            phone: vendor.phone || "",
            picPhone: vendor.picPhone || "",
            address: vendor.address || "",
            address2: vendor.address2 || "",
            officePhone: vendor.officePhone || "",
            paymentTerm: vendor.paymentTerm || "CASH",
            categoryIds: vendor.categories.map(c => c.id),
            bankName: vendor.bankName || "",
            bankAccountNumber: vendor.bankAccountNumber || "",
            bankAccountName: vendor.bankAccountName || "",
        },
    })

    // Reset form when vendor prop changes (fixes stale data bug)
    useEffect(() => {
        form.reset({
            code: vendor.code,
            name: vendor.name,
            contactTitle: vendor.contactTitle || "",
            contactName: vendor.contactName || "",
            email: vendor.email || "",
            phone: vendor.phone || "",
            picPhone: vendor.picPhone || "",
            address: vendor.address || "",
            address2: vendor.address2 || "",
            officePhone: vendor.officePhone || "",
            paymentTerm: vendor.paymentTerm || "CASH",
            categoryIds: vendor.categories.map(c => c.id),
            bankName: vendor.bankName || "",
            bankAccountNumber: vendor.bankAccountNumber || "",
            bankAccountName: vendor.bankAccountName || "",
        })
    }, [vendor.id]) // eslint-disable-line react-hooks/exhaustive-deps

    const { isSubmitting } = form.formState

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const result = await updateVendor(vendor.id, values) as any

            if (result.success) {
                toast.success("Vendor berhasil diperbarui")
                queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })
                onOpenChange(false)
            } else {
                toast.error(result.error || "Gagal memperbarui vendor")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
            console.error(error)
        }
    }

    return (
        <NBDialog open={open} onOpenChange={onOpenChange} size="narrow">
            <NBDialogHeader icon={Truck} title="Edit Vendor" subtitle="Ubah detail vendor yang sudah ada" />

            <NBDialogBody>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                        {/* Identitas Vendor */}
                        <NBSection icon={Building2} title="Identitas Vendor">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Kode Vendor <span className={NB.labelRequired}>*</span></label>
                                            <FormControl>
                                                <Input
                                                    placeholder="VND-001"
                                                    {...field}
                                                    disabled
                                                    className={`${NB.inputMono} bg-zinc-100 text-zinc-500 cursor-not-allowed`}
                                                />
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
                        </NBSection>

                        {/* Kategori Pemasok */}
                        <NBSection icon={Tag} title="Kategori Pemasok" optional>
                            {/* Category toggle chips */}
                            <div className="flex flex-wrap gap-1.5">
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
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold border-2 transition-all ${
                                                selected
                                                    ? "border-violet-500 bg-violet-500 text-white"
                                                    : "border-zinc-200 bg-white text-zinc-600 hover:border-violet-300"
                                            }`}
                                        >
                                            {cat.name}
                                            {selected && <X className="h-3 w-3 ml-0.5" />}
                                        </button>
                                    )
                                })}
                            </div>
                            {/* Add new category inline */}
                            <div className="flex gap-2 mt-2">
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
                        </NBSection>

                        {/* Kontak */}
                        <NBSection icon={User} title="Kontak" optional>
                            <div className="grid grid-cols-3 gap-4">
                                <FormField
                                    control={form.control}
                                    name="contactTitle"
                                    render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Titel</label>
                                            <FormControl>
                                                <select {...field} className={NB.select}>
                                                    <option value="">-- Pilih --</option>
                                                    {CONTACT_TITLE_OPTIONS.map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </FormControl>
                                            <FormMessage className={NB.error} />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="contactName"
                                    render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <label className={NB.label}>Kontak Person</label>
                                            <FormControl>
                                                <Input placeholder="Nama PIC..." {...field} className={NB.input} />
                                            </FormControl>
                                            <FormMessage className={NB.error} />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
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
                                <FormField
                                    control={form.control}
                                    name="picPhone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}><PhoneCall className="h-3 w-3 inline mr-1" />HP PIC</label>
                                            <FormControl>
                                                <Input placeholder="08xx..." {...field} className={NB.input} />
                                            </FormControl>
                                            <FormMessage className={NB.error} />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </NBSection>

                        {/* Alamat */}
                        <NBSection icon={MapPin} title="Alamat" optional>
                            <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem>
                                        <label className={NB.label}>Alamat Utama</label>
                                        <FormControl>
                                            <Textarea placeholder="Alamat lengkap..." {...field} className={NB.textarea} />
                                        </FormControl>
                                        <FormMessage className={NB.error} />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="address2"
                                render={({ field }) => (
                                    <FormItem>
                                        <label className={NB.label}>Alamat Cabang / Gudang</label>
                                        <FormControl>
                                            <Textarea placeholder="Alamat sekunder (opsional)..." {...field} className={NB.textarea} />
                                        </FormControl>
                                        <FormMessage className={NB.error} />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="officePhone"
                                render={({ field }) => (
                                    <FormItem>
                                        <label className={NB.label}><Phone className="h-3 w-3 inline mr-1" />Telepon Kantor</label>
                                        <FormControl>
                                            <Input placeholder="021-xxx..." {...field} className={NB.input} />
                                        </FormControl>
                                        <FormMessage className={NB.error} />
                                    </FormItem>
                                )}
                            />
                        </NBSection>

                        {/* Pembayaran */}
                        <NBSection icon={CreditCard} title="Pembayaran">
                            <FormField
                                control={form.control}
                                name="paymentTerm"
                                render={({ field }) => (
                                    <FormItem>
                                        <label className={NB.label}>Termin Pembayaran</label>
                                        <FormControl>
                                            <select {...field} className={NB.select}>
                                                {paymentTermOptions.map(t => (
                                                    <option key={t.id} value={t.code}>{t.name}</option>
                                                ))}
                                            </select>
                                        </FormControl>
                                        <FormMessage className={NB.error} />
                                    </FormItem>
                                )}
                            />
                        </NBSection>

                        {/* Info Bank */}
                        <NBSection icon={Building2} title="Info Bank" optional>
                            <FormField
                                control={form.control}
                                name="bankName"
                                render={({ field }) => (
                                    <FormItem>
                                        <label className={NB.label}>Nama Bank</label>
                                        <FormControl>
                                            <select {...field} className={NB.select}>
                                                <option value="">-- Pilih Bank --</option>
                                                {BANK_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        </FormControl>
                                        <FormMessage className={NB.error} />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-1 gap-3">
                                <FormField
                                    control={form.control}
                                    name="bankAccountNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>No. Rekening</label>
                                            <FormControl>
                                                <Input placeholder="1234567890" {...field} className={NB.inputMono} />
                                            </FormControl>
                                            <FormMessage className={NB.error} />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="bankAccountName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <label className={NB.label}>Nama Pemilik Rekening</label>
                                            <FormControl>
                                                <Input placeholder="PT Contoh Abadi" {...field} className={NB.input} />
                                            </FormControl>
                                            <FormMessage className={NB.error} />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </NBSection>

                        {/* Footer */}
                        <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 -mx-4 -mb-4 px-4 py-2.5 flex items-center justify-end gap-2 mt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                                className="border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none disabled:opacity-50"
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5 disabled:opacity-50 transition-colors"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </NBDialogBody>
        </NBDialog>
    )
}
