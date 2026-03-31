"use client"

import { useState, useEffect, useCallback } from "react"
import { Building2, Loader2, Save, AlertTriangle } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
    NBInput,
    NBTextarea,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import { queryKeys } from "@/lib/query-keys"
import type { SidebarActionCounts } from "@/hooks/use-sidebar-actions"
import { updateVendor } from "@/lib/actions/procurement"

interface IncompleteVendor {
    id: string
    name: string
    code: string
    missingFields: string[]
}

const FIELD_LABELS: Record<string, string> = {
    phone: "Telepon",
    email: "Email",
    address: "Alamat",
}

interface VendorQuickEditPopupProps {
    open: boolean
    onClose: () => void
    onAllActioned?: () => void
}

export function VendorQuickEditPopup({ open, onClose, onAllActioned }: VendorQuickEditPopupProps) {
    const [items, setItems] = useState<IncompleteVendor[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)

    // Per-vendor edit state
    const [editData, setEditData] = useState<Map<string, { phone: string; email: string; address: string }>>(new Map())

    const queryClient = useQueryClient()

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/dashboard/incomplete-vendors")
            const json = await res.json()
            const vendors = json.vendors ?? []
            setItems(vendors)
            // Initialize edit data for each vendor
            const initData = new Map<string, { phone: string; email: string; address: string }>()
            for (const v of vendors) {
                initData.set(v.id, { phone: "", email: "", address: "" })
            }
            setEditData(initData)
        } catch {
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (open) fetchData()
    }, [open, fetchData])

    const updateField = useCallback((vendorId: string, field: "phone" | "email" | "address", value: string) => {
        setEditData(prev => {
            const next = new Map(prev)
            const current = next.get(vendorId) ?? { phone: "", email: "", address: "" }
            next.set(vendorId, { ...current, [field]: value })
            return next
        })
    }, [])

    const handleSave = useCallback(async (vendor: IncompleteVendor) => {
        const data = editData.get(vendor.id)
        if (!data) return

        // Check that at least one missing field is being filled
        const updates: { phone?: string; email?: string; address?: string } = {}
        if (vendor.missingFields.includes("phone") && data.phone.trim()) {
            updates.phone = data.phone.trim()
        }
        if (vendor.missingFields.includes("email") && data.email.trim()) {
            updates.email = data.email.trim()
        }
        if (vendor.missingFields.includes("address") && data.address.trim()) {
            updates.address = data.address.trim()
        }

        if (Object.keys(updates).length === 0) {
            toast.error("Isi minimal satu field yang kosong")
            return
        }

        setSaving(vendor.id)
        try {
            const result = await updateVendor(vendor.id, updates)
            if (result.success) {
                toast.success(`Data ${vendor.name} berhasil dilengkapi`)

                // Optimistic sidebar update
                queryClient.setQueryData<SidebarActionCounts | null>(
                    queryKeys.sidebarActions.list(),
                    (old) => old ? { ...old, vendorsIncomplete: Math.max(0, old.vendorsIncomplete - 1) } : old
                )

                // Remove from list
                const remaining = items.filter((i) => i.id !== vendor.id)
                setItems(remaining)

                queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all })

                if (remaining.length === 0) {
                    onAllActioned?.()
                    onClose()
                }
            } else {
                toast.error(result.error || "Gagal menyimpan data vendor")
            }
        } catch (err: any) {
            toast.error(err.message || "Gagal menyimpan data vendor")
        } finally {
            setSaving(null)
        }
    }, [items, editData, queryClient, onClose, onAllActioned])

    return (
        <NBDialog open={open} onOpenChange={(v) => !v && onClose()}>
            <NBDialogHeader icon={Building2} title="Vendor Data Belum Lengkap" subtitle={`${items.length} vendor perlu dilengkapi`} />
            <NBDialogBody>
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-10">
                        Semua vendor sudah lengkap datanya.
                    </p>
                ) : (
                    items.map((vendor) => {
                        const data = editData.get(vendor.id) ?? { phone: "", email: "", address: "" }
                        return (
                            <NBSection key={vendor.id} icon={Building2} title={`${vendor.code} - ${vendor.name}`}>
                                <div className="space-y-2.5">
                                    {/* Missing field tags */}
                                    <div className="flex flex-wrap gap-1">
                                        {vendor.missingFields.map((field) => (
                                            <span
                                                key={field}
                                                className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border border-amber-300 bg-amber-50 text-amber-700"
                                            >
                                                <AlertTriangle className="h-2.5 w-2.5" />
                                                {FIELD_LABELS[field] || field}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Inline edit fields */}
                                    <div className="space-y-2">
                                        {vendor.missingFields.includes("phone") && (
                                            <NBInput
                                                label="Telepon"
                                                value={data.phone}
                                                onChange={(v) => updateField(vendor.id, "phone", v)}
                                                placeholder="08xx-xxxx-xxxx"
                                            />
                                        )}
                                        {vendor.missingFields.includes("email") && (
                                            <NBInput
                                                label="Email"
                                                value={data.email}
                                                onChange={(v) => updateField(vendor.id, "email", v)}
                                                placeholder="email@perusahaan.com"
                                            />
                                        )}
                                        {vendor.missingFields.includes("address") && (
                                            <NBTextarea
                                                label="Alamat"
                                                value={data.address}
                                                onChange={(v) => updateField(vendor.id, "address", v)}
                                                placeholder="Jl. ..."
                                                rows={2}
                                            />
                                        )}
                                    </div>

                                    {/* Save button */}
                                    <Button
                                        size="sm"
                                        disabled={saving === vendor.id}
                                        onClick={() => handleSave(vendor)}
                                        className="w-full h-7 px-3 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider"
                                    >
                                        {saving === vendor.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Save className="h-3 w-3 mr-1" />
                                        )}
                                        Simpan Data Vendor
                                    </Button>
                                </div>
                            </NBSection>
                        )
                    })
                )}
            </NBDialogBody>
        </NBDialog>
    )
}
