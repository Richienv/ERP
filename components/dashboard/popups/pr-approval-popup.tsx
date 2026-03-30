"use client"

import { useState, useEffect, useCallback } from "react"
import { ClipboardList, Loader2, ExternalLink } from "lucide-react"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBSection,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface PendingPR {
    id: string
    number: string
    requesterName: string
    itemCount: number
    createdAt: string
}

interface PRApprovalPopupProps {
    open: boolean
    onClose: () => void
}

export function PRApprovalPopup({ open, onClose }: PRApprovalPopupProps) {
    const [items, setItems] = useState<PendingPR[]>([])
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/dashboard/pending-prs")
            const json = await res.json()
            setItems(json.prs ?? [])
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
            <NBDialogHeader icon={ClipboardList} title="Purchase Request Menunggu" subtitle={`${items.length} PR menunggu persetujuan`} />
            <NBDialogBody>
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-10">
                        Tidak ada Purchase Request yang menunggu.
                    </p>
                ) : (
                    <>
                        {items.map((pr) => (
                            <NBSection key={pr.id} icon={ClipboardList} title={pr.number}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="space-y-0.5 min-w-0 flex-1">
                                        <p className="text-sm font-bold truncate">Pemohon: {pr.requesterName}</p>
                                        <p className="text-xs text-zinc-500">
                                            {pr.itemCount} item &middot; {new Date(pr.createdAt).toLocaleDateString("id-ID")}
                                        </p>
                                    </div>
                                    <Link href="/procurement/requests" onClick={onClose}>
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
