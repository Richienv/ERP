"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Mail, Phone, ExternalLink } from "lucide-react"

interface VendorContactDialogProps {
    vendorName: string
    email: string | null
    phone: string | null
    trigger?: React.ReactNode
}

export function VendorContactDialog({ vendorName, email, phone, trigger }: VendorContactDialogProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" className="flex-1 border-black font-bold uppercase text-xs shadow-sm hover:shadow-none bg-white">
                        Contact
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span className="font-black text-xl uppercase">Hubungi Vendor</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <Button
                        variant="outline"
                        size="lg"
                        className="h-16 justify-between border-black hover:bg-zinc-50"
                        onClick={() => phone && window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank')}
                        disabled={!phone}
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-2 rounded-full border border-green-200">
                                <Phone className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="text-left">
                                <div className="font-bold">WhatsApp</div>
                                <div className="text-xs text-muted-foreground">{phone || "Nomor tidak tersedia"}</div>
                            </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Button>

                    <Button
                        variant="outline"
                        size="lg"
                        className="h-16 justify-between border-black hover:bg-zinc-50"
                        onClick={() => email && window.location.assign(`mailto:${email}`)}
                        disabled={!email}
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-full border border-blue-200">
                                <Mail className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="text-left">
                                <div className="font-bold">Email</div>
                                <div className="text-xs text-muted-foreground">{email || "Email tidak tersedia"}</div>
                            </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
