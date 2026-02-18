"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
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
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { ArrowLeft, Save, Loader2, Tag, StickyNote, Coins } from "lucide-react"
import Link from "next/link"
import { createPriceList } from "@/lib/actions/sales"
import { toast } from "sonner"

const priceListFormSchema = z.object({
    code: z.string().min(1, "Kode daftar harga harus diisi"),
    name: z.string().min(1, "Nama daftar harga harus diisi"),
    description: z.string().optional(),
    currency: z.string().default("IDR"),
})

type PriceListFormValues = z.input<typeof priceListFormSchema>

const defaultValues: PriceListFormValues = {
    code: "",
    name: "",
    description: "",
    currency: "IDR",
}

export default function NewPriceListPage() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [isLoading, setIsLoading] = useState(false)

    const form = useForm<PriceListFormValues>({
        resolver: zodResolver(priceListFormSchema),
        defaultValues,
    })

    async function onSubmit(data: PriceListFormValues) {
        setIsLoading(true)
        try {
            const result = await createPriceList({
                code: data.code,
                name: data.name,
                description: data.description,
                currency: data.currency,
            })

            if (result.success) {
                toast.success("Daftar harga berhasil dibuat")
                queryClient.invalidateQueries({ queryKey: queryKeys.priceLists.all })
                router.push("/sales/pricelists")
            } else {
                toast.error(result.error || "Gagal membuat daftar harga")
            }
        } catch (error) {
            console.error("Error creating price list:", error)
            toast.error("Terjadi kesalahan")
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="mf-page">
            <div className="max-w-3xl">
            {/* Back Button */}
            <Link
                href="/sales/pricelists"
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors mb-5"
            >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Daftar Harga
            </Link>

            {/* Page Header */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center gap-3 border-l-[6px] border-l-emerald-400">
                    <Tag className="h-5 w-5 text-emerald-500" />
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                            Buat Daftar Harga Baru
                        </h1>
                        <p className="text-zinc-400 text-xs font-medium mt-0.5">
                            Tambahkan daftar harga baru untuk produk Anda
                        </p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                    {/* SECTION 1 — Informasi Daftar Harga */}
                    <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-emerald-400">
                            <Tag className="h-4 w-4 text-emerald-600" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Informasi Daftar Harga</h3>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <FormField
                                    control={form.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Kode *</Label>
                                            <FormControl>
                                                <Input placeholder="PL-001" className="border-2 border-black h-10 font-medium" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nama Daftar Harga *</Label>
                                            <FormControl>
                                                <Input placeholder="Harga Retail Standar" className="border-2 border-black h-10 font-medium" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2 — Deskripsi */}
                    <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-emerald-400">
                            <StickyNote className="h-4 w-4 text-emerald-600" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Deskripsi</h3>
                        </div>
                        <div className="p-5">
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Penjelasan Daftar Harga</Label>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Penjelasan singkat mengenai daftar harga ini..."
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

                    {/* SECTION 3 — Mata Uang */}
                    <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 px-5 py-2.5 border-b-2 border-black flex items-center gap-2 border-l-[5px] border-l-emerald-400">
                            <Coins className="h-4 w-4 text-emerald-600" />
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">Mata Uang</h3>
                        </div>
                        <div className="p-5">
                            <FormField
                                control={form.control}
                                name="currency"
                                render={({ field }) => (
                                    <FormItem className="space-y-1.5 max-w-[240px]">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pilih Mata Uang</Label>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="border-2 border-black h-10 font-medium">
                                                    <SelectValue placeholder="Pilih mata uang" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="IDR">IDR (Rupiah)</SelectItem>
                                                <SelectItem value="USD">USD (Dollar)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    {/* Submit Bar */}
                    <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                        <div className="p-5 flex items-center justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.push("/sales/pricelists")}
                                className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-xs tracking-wide h-11 px-6 hover:border-zinc-500 transition-colors"
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="bg-emerald-500 text-white hover:bg-emerald-600 border-2 border-emerald-600 font-black uppercase text-xs tracking-wide h-11 px-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] transition-all active:scale-[0.98]"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" /> Simpan Daftar Harga
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </form>
            </Form>
            </div>
        </div>
    )
}
