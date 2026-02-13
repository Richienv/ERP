"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Loader2, Trash2, CalendarIcon, Check, ChevronsUpDown, FileText, Download, Eye, Share2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format } from "date-fns"

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
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
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
import { Separator } from "@/components/ui/separator"
import { cn, formatIDR } from "@/lib/utils"
import { createPurchaseOrder, getProductsForPO } from "@/app/actions/purchase-order"
import { getVendors } from "@/lib/actions/procurement"
import { Calendar } from "@/components/ui/calendar"

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
    /** Controlled mode: open state from parent */
    controlledOpen?: boolean
    /** Controlled mode: callback when open state changes */
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

    // Self-fetch vendors/products if not provided
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
    const router = useRouter()

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
        router.refresh()
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
                // User cancelled or error
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
        <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="font-black text-xl text-emerald-800">PO Berhasil Dibuat!</h3>
                <p className="text-emerald-700 font-mono text-lg mt-1">{createdPO?.number}</p>
            </div>

            {/* PDF Preview Embed */}
            <div className="border border-black rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="bg-zinc-100 px-4 py-2 border-b border-black flex items-center justify-between">
                    <span className="font-bold text-sm uppercase flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Preview Dokumen
                    </span>
                    <div className="flex gap-2">
                        <a
                            href={`/api/documents/purchase-order/${createdPO?.id}?disposition=inline`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <Button variant="ghost" size="sm" className="h-7 text-xs">
                                <Eye className="h-3 w-3 mr-1" /> Buka
                            </Button>
                        </a>
                    </div>
                </div>
                <div className="relative w-full h-[400px] bg-white">
                    {/* Loading indicator */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 z-10 peer-loaded:hidden" id="pdf-loading">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-400 mb-3" />
                        <p className="text-sm text-zinc-500 font-medium">Generating PDF...</p>
                        <p className="text-xs text-zinc-400 mt-1">Mohon tunggu sebentar</p>
                    </div>
                    <iframe
                        src={`/api/documents/purchase-order/${createdPO?.id}?disposition=inline`}
                        className="w-full h-full peer"
                        title="PO Preview"
                        onLoad={(_e) => {
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
                    <Button variant="outline" className="w-full border-black">
                        <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                </a>
                <Button variant="outline" className="border-black" onClick={handleShare}>
                    <Share2 className="h-4 w-4 mr-2" /> Share
                </Button>
                <Button className="bg-black text-white hover:bg-zinc-800" onClick={handleClose}>
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
                    <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide transition-all active:translate-y-1 active:shadow-none">
                        <Plus className="mr-2 h-4 w-4" /> Buat PO
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-black text-xl uppercase flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {step === 'form' ? 'Buat Purchase Order' : 'Purchase Order Dibuat'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'form' 
                            ? 'Lengkapi form untuk membuat PO baru.' 
                            : 'Review dan bagikan dokumen PO.'}
                    </DialogDescription>
                </DialogHeader>

                {step === 'preview' ? (
                    <PreviewStep />
                ) : (
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        {/* Vendor & Date Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="supplierId"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="font-bold">Vendor *</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
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
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="expectedDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel className="font-bold">Tanggal Diharapkan</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
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
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Payment Terms & Notes Row */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="paymentTerms"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold">Termin Pembayaran</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pilih termin" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="COD">COD (Cash on Delivery)</SelectItem>
                                                <SelectItem value="CBD">CBD (Cash Before Delivery)</SelectItem>
                                                <SelectItem value="NET7">Net 7 Hari</SelectItem>
                                                <SelectItem value="NET14">Net 14 Hari</SelectItem>
                                                <SelectItem value="NET30">Net 30 Hari</SelectItem>
                                                <SelectItem value="NET45">Net 45 Hari</SelectItem>
                                                <SelectItem value="NET60">Net 60 Hari</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold">Catatan</FormLabel>
                                        <FormControl>
                                            <Textarea 
                                                placeholder="Catatan untuk vendor..." 
                                                className="resize-none h-[38px]"
                                                {...field} 
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="includeTax"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-bold">Pajak</FormLabel>
                                        <Select
                                            value={field.value ? "PPN" : "NON_PPN"}
                                            onValueChange={(value) => field.onChange(value === "PPN")}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="PPN">PPN 11%</SelectItem>
                                                <SelectItem value="NON_PPN">Non-PPN</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Items Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h3 className="font-bold text-sm uppercase text-muted-foreground">Item Pesanan</h3>
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1, unitPrice: 0 })}>
                                    <Plus className="h-4 w-4 mr-2" /> Tambah Item
                                </Button>
                            </div>

                            {fields.map((field, index) => (
                                <div key={field.id} className="grid grid-cols-12 gap-3 items-end">
                                    <div className="col-span-12 md:col-span-5">
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.productId`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className={cn("text-xs", index !== 0 && "sr-only")}>Produk</FormLabel>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button variant="outline" role="combobox" className={cn("w-full justify-between truncate", !field.value && "text-muted-foreground")}>
                                                                    {field.value
                                                                        ? products.find((p) => p.id === field.value)?.name
                                                                        : "Pilih produk"}
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                                    </div>
                                    <div className="col-span-5 md:col-span-2">
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.quantity`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className={cn("text-xs", index !== 0 && "sr-only")}>Jumlah</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="col-span-5 md:col-span-3">
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.unitPrice`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className={cn("text-xs", index !== 0 && "sr-only")}>Harga</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-2 flex justify-end">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => remove(index)}
                                            disabled={fields.length === 1}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Totals Section */}
                        <div className="border-t pt-4 bg-zinc-50 p-4 rounded-lg space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span className="font-mono">{formatIDR(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{includeTax ? "PPN 11%" : "Non-PPN"}</span>
                                <span className="font-mono">{formatIDR(taxAmount)}</span>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-lg uppercase">Total</span>
                                <span className="font-black text-2xl font-mono text-emerald-700">
                                    {formatIDR(totalAmount)}
                                </span>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-black text-white hover:bg-zinc-800">
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Membuat...
                                    </>
                                ) : (
                                    "Konfirmasi & Buat PO"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
                )}
            </DialogContent>
        </Dialog>
    )
}
