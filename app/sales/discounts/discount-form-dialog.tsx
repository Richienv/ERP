"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
    NBInput,
    NBSelect,
    NBTextarea,
} from "@/components/ui/nb-dialog"
import { Plus, Trash2, Layers, Tag, Target, Calendar } from "lucide-react"
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
        <NBDialog open={open} onOpenChange={onOpenChange}>
            <NBDialogHeader
                icon={Layers}
                title={isEditing ? "Edit Skema Diskon" : "Buat Skema Diskon Baru"}
                subtitle={isEditing
                    ? "Ubah detail skema diskon yang sudah ada"
                    : "Tentukan tipe, cakupan, dan nilai diskon"}
            />

            <NBDialogBody>
                <form
                    id="discount-form"
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-3"
                >
                    {/* ─── Identitas ─── */}
                    <NBSection icon={Tag} title="Identitas">
                        <div className="grid grid-cols-2 gap-3">
                            <NBInput
                                label="Kode"
                                required
                                value={form.watch("code")}
                                onChange={(v) => form.setValue("code", v)}
                                placeholder="DISC-001"
                            />
                            <NBInput
                                label="Nama"
                                required
                                value={form.watch("name")}
                                onChange={(v) => form.setValue("name", v)}
                                placeholder="Diskon Grosir"
                            />
                        </div>
                        <NBTextarea
                            label="Deskripsi"
                            value={form.watch("description")}
                            onChange={(v) => form.setValue("description", v)}
                            placeholder="Keterangan..."
                        />
                        <div className="flex items-center gap-3">
                            <Switch
                                checked={form.watch("isActive")}
                                onCheckedChange={(v) => form.setValue("isActive", v)}
                            />
                            <Label className="text-sm font-bold">Aktif</Label>
                        </div>
                    </NBSection>

                    {/* ─── Tipe & Nilai ─── */}
                    <NBSection icon={Layers} title="Tipe & Nilai Diskon">
                        <div className="grid grid-cols-2 gap-3">
                            <NBSelect
                                label="Tipe Diskon"
                                required
                                value={watchType}
                                onValueChange={(v) =>
                                    form.setValue("type", v as FormValues["type"])
                                }
                                options={[
                                    { value: "PERCENTAGE", label: "Persentase (%)" },
                                    { value: "FIXED", label: "Potongan Tetap (Rp)" },
                                    { value: "TIERED", label: "Bertingkat (Qty-based)" },
                                ]}
                            />

                            {watchType !== "TIERED" && (
                                <NBInput
                                    label={watchType === "PERCENTAGE" ? "Persentase (%)" : "Jumlah (Rp)"}
                                    required
                                    type="number"
                                    value={form.watch("value")}
                                    onChange={(v) => form.setValue("value", v)}
                                    placeholder={watchType === "PERCENTAGE" ? "10" : "5000"}
                                />
                            )}
                        </div>

                        {/* Tiered rules editor — complex, keep as-is */}
                        {watchType === "TIERED" && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                                        Tier Diskon <span className="text-red-500">*</span>
                                    </label>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            appendTier({ minQty: "", maxQty: "", discount: "" })
                                        }
                                        className="border border-zinc-300 font-bold text-xs rounded-none h-7"
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Tambah Tier
                                    </Button>
                                </div>

                                <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-700">
                                    <table className="w-full">
                                        <thead className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                                            <tr>
                                                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Min Qty</th>
                                                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Max Qty</th>
                                                <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Diskon (%)</th>
                                                <th className="px-3 py-2 w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tierFields.map((field, idx) => (
                                                <tr key={field.id} className="border-b border-zinc-100 dark:border-zinc-800">
                                                    <td className="px-3 py-2">
                                                        <Input
                                                            type="number"
                                                            {...form.register(`tiers.${idx}.minQty`)}
                                                            className="border border-zinc-300 font-mono font-bold h-8 rounded-none text-sm"
                                                            placeholder="1"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <Input
                                                            type="number"
                                                            {...form.register(`tiers.${idx}.maxQty`)}
                                                            className="border border-zinc-300 font-mono font-bold h-8 rounded-none text-sm"
                                                            placeholder="Kosong = ~"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            {...form.register(`tiers.${idx}.discount`)}
                                                            className="border border-zinc-300 font-mono font-bold h-8 rounded-none text-sm"
                                                            placeholder="5"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
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
                                            <p key={i} className="text-[11px] font-bold text-red-500">
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
                    </NBSection>

                    {/* ─── Cakupan ─── */}
                    <NBSection icon={Target} title="Cakupan Berlaku">
                        <NBSelect
                            label="Cakupan"
                            required
                            value={watchScope}
                            onValueChange={(v) =>
                                form.setValue("scope", v as FormValues["scope"])
                            }
                            options={[
                                { value: "GLOBAL", label: "Semua Produk (Global)" },
                                { value: "PRICELIST", label: "Daftar Harga Tertentu" },
                                { value: "CUSTOMER", label: "Pelanggan Tertentu" },
                                { value: "PRODUCT", label: "Produk Tertentu" },
                                { value: "CATEGORY", label: "Kategori Tertentu" },
                            ]}
                        />

                        {watchScope === "PRICELIST" && (
                            <NBInput
                                label="ID Daftar Harga"
                                value={form.watch("priceListId")}
                                onChange={(v) => form.setValue("priceListId", v)}
                                placeholder="UUID..."
                            />
                        )}
                        {watchScope === "CUSTOMER" && (
                            <NBInput
                                label="ID Pelanggan"
                                value={form.watch("customerId")}
                                onChange={(v) => form.setValue("customerId", v)}
                                placeholder="UUID..."
                            />
                        )}
                        {watchScope === "PRODUCT" && (
                            <NBInput
                                label="ID Produk"
                                value={form.watch("productId")}
                                onChange={(v) => form.setValue("productId", v)}
                                placeholder="UUID..."
                            />
                        )}
                        {watchScope === "CATEGORY" && (
                            <NBInput
                                label="ID Kategori"
                                value={form.watch("categoryId")}
                                onChange={(v) => form.setValue("categoryId", v)}
                                placeholder="UUID..."
                            />
                        )}
                    </NBSection>

                    {/* ─── Validitas ─── */}
                    <NBSection icon={Calendar} title="Periode & Syarat">
                        <div className="grid grid-cols-2 gap-3">
                            <NBInput
                                label="Berlaku Dari"
                                type="date"
                                value={form.watch("validFrom")}
                                onChange={(v) => form.setValue("validFrom", v)}
                            />
                            <NBInput
                                label="Berlaku Sampai"
                                type="date"
                                value={form.watch("validTo")}
                                onChange={(v) => form.setValue("validTo", v)}
                            />
                        </div>
                        <NBInput
                            label="Min. Nilai Order (Rp)"
                            type="number"
                            value={form.watch("minOrderValue")}
                            onChange={(v) => form.setValue("minOrderValue", v)}
                            placeholder="0"
                        />
                    </NBSection>
                </form>
            </NBDialogBody>

            {/* Footer — uses form attribute to submit */}
            <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 flex items-center justify-end gap-2">
                <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isBusy}
                    className="border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none disabled:opacity-50"
                >
                    Batal
                </Button>
                <Button
                    type="submit"
                    form="discount-form"
                    disabled={isBusy}
                    className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5 disabled:opacity-50 transition-colors"
                >
                    {isBusy
                        ? "Menyimpan..."
                        : isEditing
                        ? "Simpan Perubahan"
                        : "Buat Skema"}
                </Button>
            </div>
        </NBDialog>
    )
}
