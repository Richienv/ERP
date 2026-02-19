"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Share2, Power, PowerOff } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toggleVendorStatus } from "@/app/actions/vendor"
import { VendorHistoryDialog } from "./vendor-history-dialog"
import { VendorContactDialog } from "./vendor-contact-dialog"

interface VendorActionsProps {
    vendor: {
        id: string
        name: string
        phone: string | null
        email: string | null
        isActive: boolean
    }
}

export function VendorActions({ vendor }: VendorActionsProps) {
    const queryClient = useQueryClient()
    const [isToggling, setIsToggling] = useState(false)

    const handleShare = () => {
        const text = `*Vendor Information*\nName: ${vendor.name}\nPhone: ${vendor.phone || '-'}\nEmail: ${vendor.email || '-'}`
        navigator.clipboard.writeText(text)
        toast.success("Info vendor disalin ke clipboard!")
    }

    const handleToggleStatus = async () => {
        const action = vendor.isActive ? "menonaktifkan" : "mengaktifkan"
        const confirmed = window.confirm(
            `Apakah Anda yakin ingin ${action} vendor "${vendor.name}"?`
        )
        if (!confirmed) return

        setIsToggling(true)
        try {
            const result = await toggleVendorStatus(vendor.id)
            if (result.success && "message" in result) {
                toast.success(result.message)
                queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all })
            } else {
                toast.error(("error" in result ? result.error : null) || "Gagal mengubah status vendor")
            }
        } catch {
            toast.error("Gagal mengubah status vendor")
        } finally {
            setIsToggling(false)
        }
    }

    return (
        <div className="pt-4 border-t border-black bg-zinc-50 flex gap-2 p-4 mt-auto">
            <VendorHistoryDialog
                vendorId={vendor.id}
                vendorName={vendor.name}
            />

            <VendorContactDialog
                vendorName={vendor.name}
                email={vendor.email}
                phone={vendor.phone}
            />

            <Button
                variant="ghost"
                size="icon"
                className="border border-transparent hover:border-black hover:bg-white"
                onClick={handleShare}
                title="Share Vendor Info"
            >
                <Share2 className="h-4 w-4" />
            </Button>

            <Button
                variant="ghost"
                size="icon"
                className={
                    vendor.isActive
                        ? "border border-transparent hover:border-red-600 hover:bg-red-50 text-red-600 ml-auto"
                        : "border border-transparent hover:border-green-600 hover:bg-green-50 text-green-600 ml-auto"
                }
                onClick={handleToggleStatus}
                disabled={isToggling}
                title={vendor.isActive ? "Nonaktifkan Vendor" : "Aktifkan Vendor"}
            >
                {vendor.isActive ? (
                    <PowerOff className="h-4 w-4" />
                ) : (
                    <Power className="h-4 w-4" />
                )}
            </Button>
        </div>
    )
}
