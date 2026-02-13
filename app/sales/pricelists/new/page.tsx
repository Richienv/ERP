"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { ArrowLeft, Save, Tag } from "lucide-react"
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
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/sales/pricelists">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Buat Daftar Harga Baru</h1>
                    <p className="text-sm text-muted-foreground">
                        Tambahkan daftar harga baru untuk produk Anda
                    </p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center text-lg">
                                <Tag className="mr-2 h-5 w-5" />
                                Informasi Daftar Harga
                            </CardTitle>
                            <CardDescription>
                                Detail utama daftar harga. Produk dapat ditambahkan setelah daftar harga dibuat.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="code"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Kode *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="PL-001" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nama Daftar Harga *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Harga Retail Standar" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Deskripsi</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Penjelasan singkat mengenai daftar harga ini..."
                                                className="resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="currency"
                                render={({ field }) => (
                                    <FormItem className="max-w-[200px]">
                                        <FormLabel>Mata Uang</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
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
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-end gap-3">
                        <Button variant="outline" asChild>
                            <Link href="/sales/pricelists">Batal</Link>
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                "Menyimpan..."
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Simpan Daftar Harga
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
}
