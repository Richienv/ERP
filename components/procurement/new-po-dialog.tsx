"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Loader2, Trash2, CalendarIcon, Check, ChevronsUpDown, FileText, Download, Eye, Share2, ShoppingCart, Truck, Receipt } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"
import { format } from "date-fns"

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
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
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
import { cn, formatIDR } from "@/lib/utils"
import { createPurchaseOrder, getProductsForPO } from "@/app/actions/purchase-order"
import { getVendors } from "@/lib/actions/procurement"
import { Calendar } from "@/components/ui/calendar"
import { NB } from "@/lib/dialog-styles"

const formSchema = z.object({
    supplierId: z.string().min(1, "Vendor wajib dipilih"),
    expectedDate: z.date().optional(),
    paymentTerms: z.string().optional(),
    shippingAddress: z.string().optional(),
    notes: z.string().optional(),
    includeTax: z.boolean().default(true),
    items: z.array(z.object({
        productId: z.string().min(1, "Produk wajib dipilih"),
        quantity: z.coerce.number().min(1, "Minimal 1"),
        unitPrice: z.coerce.number().min(0, "Harga tidak valid")
    })).min(1, "Tambahkan minimal satu item")
})

type FormValues = z.infer<typeof formSchema>

interface NewPurchaseOrderDialogProps {
    vendors?: { id: string, name: string }[]
    products?: { id: string, name: string, code: string, unit: string, defaultPrice: number }[]
    controlledOpen?: boolean
    onOpenChange?: (open: boolean) => void
}

type DialogStep = 'form' | 'preview'

export function NewPurchaseOrderDialog({ vendors: vendorsProp, products: productsProp, controlledOpen, onOpenChange }: NewPurchaseOrderDialogProps) {
    const isControlled = controlledOpen !== undefined
    const [internalOpen, setInternalOpen] = useState(false)
    const open = isControlled ? controlledOpen : internalOpen
    const setOpen = (v: boolean) => {
        if (isControlled) onOpenChange?.(v)
        else setInternalOpen(v)
    }

    const [fetchedVendors, setFetchedVendors] = useState<{ id: string, name: string }[]>([])
    const [fetchedProducts, setFetchedProducts] = useState<{ id: string, name: string, code: string, unit: string, defaultPrice: number }[]>([])
    const [loadingData, setLoadingData] = useState(false)

    const vendors = vendorsProp ?? fetchedVendors
    const products = productsProp ?? fetchedProducts

    useEffect(() => {
        if (!open || (vendorsProp && productsProp)) return
        let active = true
        const fetchData = async () => {
            setLoadingData(true)
            try {
                const [vendorData, productData] = await Promise.all([
                    getVendors(),
                    getProductsForPO(),
                ])
                if (!active) return
                setFetchedVendors(vendorData.map((v: any) => ({ id: v.id, name: v.name })))
                setFetchedProducts(productData.map((p: any) => ({ id: p.id, name: p.name, code: p.code, unit: p.unit || 'PCS', defaultPrice: p.defaultPrice || 0 })))
            } catch (e) {
                console.error("Failed to fetch PO dialog data:", e)
            } finally {
                if (active) setLoadingData(false)
            }
        }
        fetchData()
        return () => { active = false }
    }, [open, vendorsProp, productsProp])

    const [step, setStep] = useState<DialogStep>('form')
    const [createdPO, setCreatedPO] = useState<{ id: string, number: string } | null>(null)
    const queryClient = useQueryClient()

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            supplierId: "",
            paymentTerms: "NET30",
            shippingAddress: "",
            notes: "",
            includeTax: true,
            items: [{ productId: "", quantity: 1, unitPrice: 0 }]
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    })

    const { isSubmitting } = form.formState
    const watchedItems = form.watch("items")

    const includeTax = form.watch("includeTax")
    const subtotal = watchedItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)
    const taxAmount = includeTax ? (subtotal * 0.11) : 0
    const totalAmount = subtotal + taxAmount

    async function onSubmit(values: FormValues) {
        const result = await createPurchaseOrder({
            supplierId: values.supplierId,
            expectedDate: values.expectedDate,
            notes: values.notes,
            paymentTerms: values.paymentTerms,
            shippingAddress: values.shippingAddress,
            includeTax: values.includeTax,
            items: values.items
        })

        if (result.success && result.poId) {
            setCreatedPO({ id: result.poId, number: result.number || '' })
            setStep('preview')
            toast.success(`PO ${result.number} berhasil dibuat!`)
        } else {
            toast.error('error' in result ? result.error : "Gagal membuat PO")
        }
    }

    const handleProductSelect = (index: number, productId: string) => {
        const product = products.find(p => p.id === productId)
        if (product) {
            form.setValue(`items.${index}.productId`, productId)
            form.setValue(`items.${index}.unitPrice`, product.defaultPrice)
        }
    }

    const handleClose = () => {
        setOpen(false)
        setStep('form')
        setCreatedPO(null)
        form.reset()
        queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
    }

    const handleShare = async () => {
        if (!createdPO) return
        const pdfUrl = `${window.location.origin}/api/documents/purchase-order/${createdPO.id}?disposition=inline`

        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Purchase Order ${createdPO.number}`,
                    text: `Silakan review Purchase Order ${createdPO.number}`,
                    url: pdfUrl
                })
            } catch {
                await navigator.clipboard.writeText(pdfUrl)
                toast.success("Link PDF disalin ke clipboard!")
            }
        } else {
            await navigator.clipboard.writeText(pdfUrl)
            toast.success("Link PDF disalin ke clipboard!")
        }
    }

    // Preview Step Component
    const PreviewStep = () => (
        <div className="p-5 space-y-4">
            {/* Success Banner */}
            <div className="border-2 border-black bg-emerald-50 p-6 text-center">
                <div className="w-14 h-14 bg-black flex items-center justify-center mx-auto mb-3">
                    <Check className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-black text-xl uppercase tracking-wider">PO Berhasil Dibuat!</h3>
                <p className="font-mono font-bold text-lg mt-1">{createdPO?.number}</p>
            </div>

            {/* PDF Preview */}
            <div className={NB.section}>
                <div className={NB.sectionHead}>
                    <FileText className="h-4 w-4" />
                    <span className={NB.sectionTitle}>Preview Dokumen</span>
                    <div className="ml-auto flex gap-2">
                        <a
                            href={`/api/documents/purchase-order/${createdPO?.id}?disposition=inline`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <Button variant="ghost" size="sm" className="h-7 text-xs font-bold">
                                <Eye className="h-3 w-3 mr-1" /> Buka
                            </Button>
                        </a>
                    </div>
                </div>
                <div className="relative w-full h-[400px] bg-white">
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 z-10" id="pdf-loading">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-400 mb-3" />
                        <p className="text-sm text-zinc-500 font-bold">Generating PDF...</p>
                    </div>
                    <iframe
                        src={`/api/documents/purchase-order/${createdPO?.id}?disposition=inline`}
                        className="w-full h-full"
                        title="PO Preview"
                        onLoad={() => {
                            const loadingEl = document.getElementById('pdf-loading')
                            if (loadingEl) loadingEl.style.display = 'none'
                        }}
                    />
                </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
                <a
                    href={`/api/documents/purchase-order/${createdPO?.id}`}
                    download={`${createdPO?.number}.pdf`}
                    target="_blank"
                    rel="noreferrer"
                >
                    <Button variant="outline" className={NB.cancelBtn + " w-full"}>
                        <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                </a>
                <Button variant="outline" className={NB.cancelBtn} onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-2" /> Share
                </Button>
                <Button className={NB.submitBtn} onClick={handleClose}>
                    <Check className="h-4 w-4 mr-2" /> Selesai
                </Button>
            </div>
        </div>
    )

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) handleClose()
            else setOpen(true)
        }}>
            {!isControlled && (
                <DialogTrigger asChild>
                    <Button className={NB.triggerBtn}>
                        <Plus className="mr-2 h-4 w-4" /> Buat PO
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <FileText className="h-5 w-5" />
                        {step === 'form' ? 'Buat Purchase Order' : 'Purchase Order Dibuat'}
                    </DialogTitle>
                    <p className={NB.subtitle}>
                        {step === 'form'
                            ? 'Lengkapi form untuk membuat PO baru'
                            : 'Review dan bagikan dokumen PO'}
                    </p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    {step === 'preview' ? (
                        <PreviewStep />
                    ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="p-5 space-y-4">

                            {/* Vendor & Date */}
                            <div className={NB.section}>
                                <div className={`${NB.sectionHead} border-l-4 border-l-violet-400 bg-violet-50`}>
                                    <Truck className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Vendor & Jadwal</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="supplierId"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <label className={NB.label}>Vendor <span className={NB.labelRequired}>*</span></label>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button variant="outline" role="combobox" className={cn(NB.select + " justify-between", !field.value && "text-muted-foreground")}>
                                                                    {field.value
                                                                        ? vendors.find((v) => v.id === field.value)?.name
                                                                        : "Pilih vendor"}
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[300px] p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Cari vendor..." />
                                                                <CommandList>
                                                                    <CommandEmpty>Vendor tidak ditemukan.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {vendors.map((vendor) => (
                                                                            <CommandItem
                                                                                value={vendor.name}
                                                                                key={vendor.id}
                                                                                onSelect={() => {
                                                                                    form.setValue("supplierId", vendor.id)
                                                                                }}
                                                                            >
                                                                                <Check className={cn("mr-2 h-4 w-4", vendor.id === field.value ? "opacity-100" : "opacity-0")} />
                                                                                {vendor.name}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                    <FormMessage className={NB.error} />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="expectedDate"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-col">
                                                    <label className={NB.label}>Tanggal Diharapkan</label>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button variant="outline" className={cn(NB.input + " w-full pl-3 text-left font-bold", !field.value && "text-muted-foreground")}>
                                                                    {field.value ? format(field.value, "PPP") : <span>Pilih tanggal</span>}
                                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0" align="start">
                                                            <Calendar
                                                                mode="single"
                                                                selected={field.value}
                                                                onSelect={field.onChange}
                                                                disabled={(date: Date) => date < new Date()}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                    <FormMessage className={NB.error} />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Payment & Notes */}
                            <div className={NB.section}>
                                <div className={`${NB.sectionHead} border-l-4 border-l-violet-400 bg-violet-50`}>
                                    <Receipt className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Pembayaran & Catatan</span>
                                </div>
                                <div className={NB.sectionBody}>
                                    <div className="grid grid-cols-3 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="paymentTerms"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <label className={NB.label}>Termin Pembayaran</label>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className={NB.select}>
                                                                <SelectValue placeholder="Pilih termin" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="COD">COD</SelectItem>
                                                            <SelectItem value="CBD">CBD</SelectItem>
                                                            <SelectItem value="NET7">Net 7</SelectItem>
                                                            <SelectItem value="NET14">Net 14</SelectItem>
                                                            <SelectItem value="NET30">Net 30</SelectItem>
                                                            <SelectItem value="NET45">Net 45</SelectItem>
                                                            <SelectItem value="NET60">Net 60</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage className={NB.error} />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="includeTax"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <label className={NB.label}>Pajak</label>
                                                    <Select
                                                        value={field.value ? "PPN" : "NON_PPN"}
                                                        onValueChange={(value) => field.onChange(value === "PPN")}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger className={NB.select}>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="PPN">PPN 11%</SelectItem>
                                                            <SelectItem value="NON_PPN">Non-PPN</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage className={NB.error} />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="notes"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <label className={NB.label}>Catatan</label>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Catatan untuk vendor..."
                                                            className={NB.textarea + " min-h-[40px]"}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage className={NB.error} />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Items Section */}
                            <div className={NB.section}>
                                <div className={`${NB.sectionHead} border-l-4 border-l-violet-400 bg-violet-50`}>
                                    <ShoppingCart className="h-4 w-4" />
                                    <span className={NB.sectionTitle}>Item Pesanan</span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => append({ productId: "", quantity: 1, unitPrice: 0 })}
                                        className="ml-auto h-7 text-[10px] font-black uppercase tracking-wider border-2 border-black"
                                    >
                                        <Plus className="h-3 w-3 mr-1" /> Tambah
                                    </Button>
                                </div>

                                {/* Items Table */}
                                <div className="overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className={NB.tableHead}>
                                            <tr>
                                                <th className={NB.tableHeadCell + " text-left"}>Produk</th>
                                                <th className={NB.tableHeadCell + " text-center w-24"}>Jumlah</th>
                                                <th className={NB.tableHeadCell + " text-center w-36"}>Harga Satuan</th>
                                                <th className={NB.tableHeadCell + " text-right w-32"}>Subtotal</th>
                                                <th className={NB.tableHeadCell + " w-12"}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fields.map((field, index) => {
                                                const itemSubtotal = (watchedItems[index]?.quantity || 0) * (watchedItems[index]?.unitPrice || 0)
                                                return (
                                                    <tr key={field.id} className={NB.tableRow}>
                                                        <td className={NB.tableCell}>
                                                            <FormField
                                                                control={form.control}
                                                                name={`items.${index}.productId`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <FormControl>
                                                                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between border-2 border-black font-bold h-9 text-xs", !field.value && "text-muted-foreground")}>
                                                                                        {field.value
                                                                                            ? products.find((p) => p.id === field.value)?.name
                                                                                            : "Pilih produk"}
                                                                                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                                                                    </Button>
                                                                                </FormControl>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-[300px] p-0">
                                                                                <Command>
                                                                                    <CommandInput placeholder="Cari produk..." />
                                                                                    <CommandList>
                                                                                        <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                                                                                        <CommandGroup>
                                                                                            {products.map((product) => (
                                                                                                <CommandItem
                                                                                                    value={product.name}
                                                                                                    key={product.id}
                                                                                                    onSelect={() => handleProductSelect(index, product.id)}
                                                                                                >
                                                                                                    <Check className={cn("mr-2 h-4 w-4", product.id === field.value ? "opacity-100" : "opacity-0")} />
                                                                                                    {product.name}
                                                                                                </CommandItem>
                                                                                            ))}
                                                                                        </CommandGroup>
                                                                                    </CommandList>
                                                                                </Command>
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </td>
                                                        <td className={NB.tableCell}>
                                                            <FormField
                                                                control={form.control}
                                                                name={`items.${index}.quantity`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input type="number" {...field} className="border-2 border-black font-mono font-bold h-9 text-center text-xs" />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </td>
                                                        <td className={NB.tableCell}>
                                                            <FormField
                                                                control={form.control}
                                                                name={`items.${index}.unitPrice`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input type="number" {...field} className="border-2 border-black font-mono font-bold h-9 text-right text-xs" />
                                                                        </FormControl>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </td>
                                                        <td className={NB.tableCell + " text-right"}>
                                                            <span className="font-mono font-bold text-xs">{formatIDR(itemSubtotal)}</span>
                                                        </td>
                                                        <td className={NB.tableCell}>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => remove(index)}
                                                                disabled={fields.length === 1}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Totals */}
                                <div className="border-t-2 border-black bg-zinc-50 p-4 space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className={NB.label + " !mb-0"}>Subtotal</span>
                                        <span className="font-mono font-bold">{formatIDR(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className={NB.label + " !mb-0"}>{includeTax ? "PPN 11%" : "Non-PPN"}</span>
                                        <span className="font-mono font-bold">{formatIDR(taxAmount)}</span>
                                    </div>
                                    <div className="border-t-2 border-black pt-2 mt-2 flex justify-between items-center">
                                        <span className="font-black text-sm uppercase tracking-wider">Total</span>
                                        <span className="font-black text-xl font-mono">
                                            {formatIDR(totalAmount)}
                                        </span>
                                    </div>
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
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Membuat...
                                        </>
                                    ) : (
                                        "Konfirmasi & Buat PO"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
