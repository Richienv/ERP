"use client"

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Building2,
    MapPin,
    Phone,
    MoreHorizontal,
    AlertCircle,
    MessageCircle,
    FileText,
    DollarSign
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"

interface Customer {
    id: string
    code: string
    name: string
    customerType: string
    city: string
    phone: string
    email: string
    creditStatus: string
    totalOrderValue: number
    lastOrderDate: string | null
    isActive: boolean
    isProspect: boolean
}

interface CustomerRolodexCardProps {
    customer: Customer
}

export function CustomerRolodexCard({ customer }: CustomerRolodexCardProps) {
    const buildWhatsappPhone = (rawPhone: string) => {
        const digits = rawPhone.replace(/\D/g, "")
        if (!digits) return ""
        if (digits.startsWith("0")) return `62${digits.slice(1)}`
        return digits
    }

    const handleWhatsappClick = () => {
        const phone = buildWhatsappPhone(customer.phone || "")
        if (!phone) return
        const text = encodeURIComponent(`Halo ${customer.name}, kami dari tim Sales ERP ingin follow up kebutuhan Anda.`)
        window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener,noreferrer")
    }

    // Determine Tier based on Total Value (Mock Logic)
    const getTier = (value: number) => {
        if (value > 2000000000) return { label: "PLATINUM", color: "bg-zinc-900 text-white border-zinc-900" } // > 2M
        if (value > 500000000) return { label: "GOLD", color: "bg-amber-100 text-amber-800 border-amber-200" } // > 500k
        return { label: "SILVER", color: "bg-zinc-100 text-zinc-800 border-zinc-200" }
    }

    const tier = getTier(customer.totalOrderValue)

    // Status Indicator Color
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'GOOD': return 'bg-emerald-500'
            case 'WATCH': return 'bg-yellow-500'
            case 'HOLD': return 'bg-red-500'
            default: return 'bg-zinc-400'
        }
    }

    return (
        <Card className="group relative overflow-hidden border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white">
            {/* Top Stripe for "Physical Folder" look */}
            <div className="absolute top-0 left-0 w-full h-1 bg-black" />

            <CardHeader className="p-4 pb-2 pt-5">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] font-black tracking-widest border border-black rounded-sm ${tier.color}`}>
                                {tier.label}
                            </Badge>
                            {customer.isProspect && (
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                    PROSPECT
                                </Badge>
                            )}
                        </div>
                        <h3 className="font-black text-lg uppercase leading-tight line-clamp-2 min-h-[3rem] mt-1">
                            {customer.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                            <Building2 className="h-3 w-3" />
                            {customer.code}
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <DropdownMenuLabel>Aksi Cepat</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href={`/sales/customers/${customer.id}`}>View Profile</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem>Edit Data</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">Suspend Account</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-4">
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 border border-black/10 rounded bg-zinc-50">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total Revenue</p>
                        <p className="font-black text-sm">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact' }).format(customer.totalOrderValue)}
                        </p>
                    </div>
                    <div className="p-2 border border-black/10 rounded bg-zinc-50 relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1 h-full ${getStatusColor(customer.creditStatus)}`} />
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1 pl-2">Credit Status</p>
                        <p className="font-bold text-xs pl-2 flex items-center gap-1">
                            {customer.creditStatus === 'GOOD' ? 'LANCAR' : customer.creditStatus}
                            {customer.creditStatus === 'HOLD' && <AlertCircle className="h-3 w-3 text-red-500" />}
                        </p>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3 w-3 text-black" />
                        <span className="truncate">{customer.city}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3 text-black" />
                        <span>{customer.phone}</span>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="p-3 bg-zinc-50 border-t border-black grid grid-cols-3 gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold border-black hover:bg-zinc-100 px-0 flex gap-1"
                    onClick={handleWhatsappClick}
                    disabled={!buildWhatsappPhone(customer.phone || "")}
                >
                    <MessageCircle className="h-3 w-3" /> WA
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8 text-[10px] font-bold border-black hover:bg-zinc-100 px-0 flex gap-1">
                    <Link href={`/sales/quotations/new?customerId=${customer.id}`}>
                        <FileText className="h-3 w-3" /> Quote
                    </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8 text-[10px] font-bold border-black bg-black text-white hover:bg-zinc-800 hover:text-white px-0 flex gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]">
                    <Link href={`/sales/orders/new?customerId=${customer.id}`}>
                        <DollarSign className="h-3 w-3" /> Order
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    )
}
