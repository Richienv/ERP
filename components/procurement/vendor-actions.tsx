"use client"

import { Button } from "@/components/ui/button"
import { Share2 } from "lucide-react"
import { toast } from "sonner"
import { VendorHistoryDialog } from "./vendor-history-dialog"
import { VendorContactDialog } from "./vendor-contact-dialog"

interface VendorActionsProps {
    vendor: {
        id: string
        name: string
        phone: string | null
        email: string | null
    }
}

export function VendorActions({ vendor }: VendorActionsProps) {

    const handleShare = () => {
        const text = `*Vendor Information*\nName: ${vendor.name}\nPhone: ${vendor.phone || '-'}\nEmail: ${vendor.email || '-'}`
        navigator.clipboard.writeText(text)
        toast.success("Info vendor disalin ke clipboard!")
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
        </div>
    )
}
