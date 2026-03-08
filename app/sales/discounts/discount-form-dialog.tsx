"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NB } from "@/lib/dialog-styles"
import { Plus, Trash2, Layers } from "lucide-react"
import { DiscountSchemeRow, useCreateDiscount, useUpdateDiscount } from "@/hooks/use-discounts"
import { validateTieredRules, TieredRule } from "@/lib/discount-calculator"

// ─── Types ───────────────────────────────────────────────────────────────

type FormValues = {
    code: string
    name: string
    description: string
    type: "PERCENTAGE" | "FIXED" | "TIERED"
    scope: "GLOBAL" | "PRICELIST" | "CUSTOMER" | "PRODUCT" | "CATEGORY"
    value: string
    isActive: boolean
    validFrom: string
    validTo: string
    minOrderValue: string
    // Scope target IDs (simple text input — user types ID or picks from list)
    priceListId: string
    customerId: string
    productId: string
    categoryId: string
    // Tiered rules
    tiers: { minQty: string; maxQty: string; discount: string }[]
}

interface DiscountFormDialogProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    editing: DiscountSchemeRow | null
}

// ─── Component ───────────────────────────────────────────────────────────

export function DiscountFormDialog({ open, onOpenChange, editing }: DiscountFormDialogProps) {
    const createMutation = useCreateDiscount()
    const updateMutation = useUpdateDiscount()
    const [tierErrors, setTierErrors] = useState<string[]>([])

    const isEditing = !!editing

    const form = useForm<FormValues>({
        defaultValues: {
            code: "",
            name: "",
            description: "",
            type: "PERCENTAGE",
            scope: "GLOBAL",
            value: "",
            isActive: true,
            validFrom: "",
            validTo: "",
            minOrderValue: "",
            priceListId: "",
            customerId: "",
            productId: "",
            categoryId: "",
            tiers: [{ minQty: "1", maxQty: "99", discount: "5" }],
        },
    })

    const { fields: tierFields, append: appendTier, remove: removeTier } = useFieldArray({
        control: form.control,
        name: "tiers",
    })

    const watchType = form.watch("type")
    const watchScope = form.watch("scope")

    // Populate form when editing
    useEffect(() => {
        if (!open) return
        if (editing) {
            const tieredRules = Array.isArray(editing.tieredRules)
                ? editing.tieredRules.map((r: any) => ({
                      minQty: String(r.minQty ?? ""),
                      maxQty: r.maxQty != null ? String(r.maxQty) : "",
                      discount: String(r.discount ?? ""),
                  }))
                : [{ minQty: "1", maxQty: "99", discount: "5" }]

            form.reset({
                code: editing.code,
                name: editing.name,
                description: editing.description || "",
                type: editing.type,
                scope: editing.scope,
                value: editing.value ? String(Number(editing.value)) : "",
                isActive: editing.isActive,
                validFrom: editing.validFrom ? editing.validFrom.slice(0, 10) : "",
                validTo: editing.validTo ? editing.validTo.slice(0, 10) : "",
                minOrderValue: editing.minOrderValue ? String(Number(editing.minOrderValue)) : "",
                priceListId: editing.priceListId || "",
                customerId: editing.customerId || "",
                productId: editing.productId || "",
                categoryId: editing.categoryId || "",
                tiers: tieredRules,
            })
        } else {
            form.reset({
                code: "",
                name: "",
                description: "",
                type: "PERCENTAGE",
                scope: "GLOBAL",
                value: "",
                isActive: true,
                validFrom: "",
                validTo: "",
                minOrderValue: "",
                priceListId: "",
                customerId: "",
                productId: "",
                categoryId: "",
                tiers: [{ minQty: "1", maxQty: "99", discount: "5" }],
            })
        }
        setTierErrors([])
    }, [open, editing, form])

    const onSubmit = (values: FormValues) => {
        // Build tiered rules
        let tieredRules: TieredRule[] | null = null
        if (values.type === "TIERED") {
            tieredRules = values.tiers.map((t) => ({
                minQty: Number(t.minQty) || 0,
                maxQty: t.maxQty ? Number(t.maxQty) : null,
                discount: Number(t.discount) || 0,
            }))
            const errors = validateTieredRules(tieredRules)
            if (errors.length > 0) {
                setTierErrors(errors)
                return
            }
        }
        setTierErrors([])

        const payload: Record<string, any> = {
            code: values.code.trim(),
            name: values.name.trim(),
            description: values.description.trim() || null,
            type: values.type,
            scope: values.scope,
            value: values.type !== "TIERED" && values.value ? Number(values.value) : null,
            tieredRules: values.type === "TIERED" ? tieredRules : null,
            isActive: values.isActive,
            validFrom: values.validFrom || null,
            validTo: values.validTo || null,
            minOrderValue: values.minOrderValue ? Number(values.minOrderValue) : null,
            priceListId: values.scope === "PRICELIST" ? values.priceListId || null : null,
            customerId: values.scope === "CUSTOMER" ? values.customerId || null : null,
            productId: values.scope === "PRODUCT" ? values.productId || null : null,
            categoryId: values.scope === "CATEGORY" ? values.categoryId || null : null,
        }

        if (isEditing) {
            updateMutation.mutate(
                { id: editing!.id, ...payload },
                { onSuccess: () => onOpenChange(false) }
            )
        } else {
            createMutation.mutate(payload, {
                onSuccess: () => onOpenChange(false),
            })
        }
    }

    const isBusy = createMutation.isPending || updateMutation.isPending

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Layers className="h-5 w-5" />
                        {isEditing ? "Edit Skema Diskon" : "Buat Skema Diskon Baru"}
                    </DialogTitle>
                    <p className={NB.subtitle}>
                        {isEditing
                            ? "Ubah detail skema diskon yang sudah ada"
                            : "Tentukan tipe, cakupan, dan nilai diskon"}
                    </p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="p-6 space-y-5"
                    >
                        {/* ─── Identitas ─── */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Identitas</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className={NB.label}>
                                            Kode <span className={NB.labelRequired}>*</span>
                                        </Label>
                                        <Input
                                            {...form.register("code", { required: true })}
                                            className={NB.input}
                                            placeholder="DISC-001"
                                        />
                                    </div>
                                    <div>
                                        <Label className={NB.label}>
                                            Nama <span className={NB.labelRequired}>*</span>
                                        </Label>
                                        <Input
                                            {...form.register("name", { required: true })}
                                            className={NB.input}
                                            placeholder="Diskon Grosir"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className={NB.label}>Deskripsi</Label>
                                    <Textarea
                                        {...form.register("description")}
                                        className={NB.textarea}
                                        placeholder="Keterangan..."
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <Switch
                                        checked={form.watch("isActive")}
                                        onCheckedChange={(v) => form.setValue("isActive", v)}
                                    />
                                    <Label className="text-sm font-bold">Aktif</Label>
                                </div>
                            </div>
                        </div>

                        {/* ─── Tipe & Nilai ─── */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Tipe & Nilai Diskon</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className={NB.label}>
                                            Tipe Diskon <span className={NB.labelRequired}>*</span>
                                        </Label>
                                        <Select
                                            value={watchType}
                                            onValueChange={(v) =>
                                                form.setValue("type", v as FormValues["type"])
                                            }
                                        >
                                            <SelectTrigger className={NB.select}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="PERCENTAGE">Persentase (%)</SelectItem>
                                                <SelectItem value="FIXED">Potongan Tetap (Rp)</SelectItem>
                                                <SelectItem value="TIERED">Bertingkat (Qty-based)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {watchType !== "TIERED" && (
                                        <div>
                                            <Label className={NB.label}>
                                                {watchType === "PERCENTAGE" ? "Persentase (%)" : "Jumlah (Rp)"}
                                                <span className={NB.labelRequired}> *</span>
                                            </Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                {...form.register("value", { required: true })}
                                                className={NB.inputMono}
                                                placeholder={watchType === "PERCENTAGE" ? "10" : "5000"}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Tiered rules editor */}
                                {watchType === "TIERED" && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className={NB.label}>
                                                Tier Diskon <span className={NB.labelRequired}>*</span>
                                            </Label>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    appendTier({ minQty: "", maxQty: "", discount: "" })
                                                }
                                                className="border-2 border-black font-bold text-xs rounded-none h-7"
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                Tambah Tier
                                            </Button>
                                        </div>

                                        <div className={NB.tableWrap}>
                                            <table className="w-full">
                                                <thead>
                                                    <tr className={NB.tableHead}>
                                                        <th className={NB.tableHeadCell}>Min Qty</th>
                                                        <th className={NB.tableHeadCell}>Max Qty</th>
                                                        <th className={NB.tableHeadCell}>Diskon (%)</th>
                                                        <th className={NB.tableHeadCell + " w-10"}></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tierFields.map((field, idx) => (
                                                        <tr key={field.id} className={NB.tableRow}>
                                                            <td className={NB.tableCell}>
                                                                <Input
                                                                    type="number"
                                                                    {...form.register(`tiers.${idx}.minQty`)}
                                                                    className="border-2 border-black font-mono font-bold h-8 rounded-none text-sm"
                                                                    placeholder="1"
                                                                />
                                                            </td>
                                                            <td className={NB.tableCell}>
                                                                <Input
                                                                    type="number"
                                                                    {...form.register(`tiers.${idx}.maxQty`)}
                                                                    className="border-2 border-black font-mono font-bold h-8 rounded-none text-sm"
                                                                    placeholder="Kosong = ~"
                                                                />
                                                            </td>
                                                            <td className={NB.tableCell}>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    {...form.register(`tiers.${idx}.discount`)}
                                                                    className="border-2 border-black font-mono font-bold h-8 rounded-none text-sm"
                                                                    placeholder="5"
                                                                />
                                                            </td>
                                                            <td className={NB.tableCell}>
                                                                {tierFields.length > 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-7 w-7 text-red-500"
                                                                        onClick={() => removeTier(idx)}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {tierErrors.length > 0 && (
                                            <div className="space-y-1">
                                                {tierErrors.map((e, i) => (
                                                    <p key={i} className={NB.error}>
                                                        {e}
                                                    </p>
                                                ))}
                                            </div>
                                        )}

                                        <p className="text-[10px] text-zinc-400 font-bold">
                                            Contoh tekstil: 1-99m → 0%, 100-499m → 5%, 500-999m → 10%, 1000+ → 15%
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ─── Cakupan ─── */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Cakupan Berlaku</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div>
                                    <Label className={NB.label}>
                                        Cakupan <span className={NB.labelRequired}>*</span>
                                    </Label>
                                    <Select
                                        value={watchScope}
                                        onValueChange={(v) =>
                                            form.setValue("scope", v as FormValues["scope"])
                                        }
                                    >
                                        <SelectTrigger className={NB.select}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="GLOBAL">Semua Produk (Global)</SelectItem>
                                            <SelectItem value="PRICELIST">Daftar Harga Tertentu</SelectItem>
                                            <SelectItem value="CUSTOMER">Pelanggan Tertentu</SelectItem>
                                            <SelectItem value="PRODUCT">Produk Tertentu</SelectItem>
                                            <SelectItem value="CATEGORY">Kategori Tertentu</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {watchScope === "PRICELIST" && (
                                    <div>
                                        <Label className={NB.label}>ID Daftar Harga</Label>
                                        <Input
                                            {...form.register("priceListId")}
                                            className={NB.input}
                                            placeholder="UUID..."
                                        />
                                    </div>
                                )}
                                {watchScope === "CUSTOMER" && (
                                    <div>
                                        <Label className={NB.label}>ID Pelanggan</Label>
                                        <Input
                                            {...form.register("customerId")}
                                            className={NB.input}
                                            placeholder="UUID..."
                                        />
                                    </div>
                                )}
                                {watchScope === "PRODUCT" && (
                                    <div>
                                        <Label className={NB.label}>ID Produk</Label>
                                        <Input
                                            {...form.register("productId")}
                                            className={NB.input}
                                            placeholder="UUID..."
                                        />
                                    </div>
                                )}
                                {watchScope === "CATEGORY" && (
                                    <div>
                                        <Label className={NB.label}>ID Kategori</Label>
                                        <Input
                                            {...form.register("categoryId")}
                                            className={NB.input}
                                            placeholder="UUID..."
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ─── Validitas ─── */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Periode & Syarat</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className={NB.label}>Berlaku Dari</Label>
                                        <Input
                                            type="date"
                                            {...form.register("validFrom")}
                                            className={NB.input}
                                        />
                                    </div>
                                    <div>
                                        <Label className={NB.label}>Berlaku Sampai</Label>
                                        <Input
                                            type="date"
                                            {...form.register("validTo")}
                                            className={NB.input}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className={NB.label}>Min. Nilai Order (Rp)</Label>
                                    <Input
                                        type="number"
                                        {...form.register("minOrderValue")}
                                        className={NB.inputMono}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ─── Footer ─── */}
                        <div className={NB.footer}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className={NB.cancelBtn}
                                disabled={isBusy}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                className={NB.submitBtn}
                                disabled={isBusy}
                            >
                                {isBusy
                                    ? "Menyimpan..."
                                    : isEditing
                                    ? "Simpan Perubahan"
                                    : "Buat Skema"}
                            </Button>
                        </div>
                    </form>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
