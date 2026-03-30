"use client"

import { useState, useEffect, useCallback } from "react"
import { Building2, Loader2, ExternalLink, AlertTriangle } from "lucide-react"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import Link from "next/link"

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
}

export function VendorQuickEditPopup({ open, onClose }: VendorQuickEditPopupProps) {
    const [items, setItems] = useState<IncompleteVendor[]>([])
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/dashboard/incomplete-vendors")
            const json = await res.json()
            setItems(json.vendors ?? [])
        } catch {
            setItems([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (open) fetchData()
    }, [open, fetchData])

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
                    <>
                        {items.map((vendor) => (
                            <NBSection key={vendor.id} icon={Building2} title={`${vendor.code} - ${vendor.name}`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="space-y-1 min-w-0 flex-1">
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
                                    </div>
                                    <Link href="/procurement/vendors" onClick={onClose}>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-3 rounded-none border-zinc-300 text-zinc-700 text-[10px] font-black uppercase tracking-wider"
                                        >
                                            <ExternalLink className="h-3 w-3 mr-1" />
                                            Lihat Detail
                                        </Button>
                                    </Link>
                                </div>
                            </NBSection>
                        ))}
                    </>
                )}
            </NBDialogBody>
        </NBDialog>
    )
}
