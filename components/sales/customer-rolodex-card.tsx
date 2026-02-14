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
    DollarSign,
    Sparkles,
    User
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

    const nextAction = (() => {
        if (customer.creditStatus === "HOLD" || customer.creditStatus === "BLOCKED") {
            return {
                label: "Review Kredit",
                description: "Status kredit perlu review sebelum transaksi baru.",
                href: `/sales/customers/${customer.id}`,
            }
        }

        if (customer.isProspect) {
            return {
                label: "Buat Quote Cepat",
                description: "Prospek baru, mulai dari quotation 1 langkah.",
                href: `/sales/quotations/new?customerId=${customer.id}`,
            }
        }

        return {
            label: "Buat Order Cepat",
            description: "Pelanggan aktif, lanjutkan langsung ke Sales Order.",
            href: `/sales/orders/new?customerId=${customer.id}`,
        }
    })()

    // Status Indicator Color
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'GOOD': return 'bg-emerald-500'
            case 'WATCH': return 'bg-amber-500'
            case 'HOLD': return 'bg-red-500'
            default: return 'bg-zinc-400'
        }
    }

    return (
        <Card className="group relative overflow-hidden border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white rounded-none flex flex-col justify-between">
            {/* Top Stripe */}
            <div className={`absolute top-0 left-0 w-full h-1.5 ${tier.color.includes('bg-zinc-900') ? 'bg-zinc-900' : tier.color.includes('bg-amber') ? 'bg-amber-400' : 'bg-zinc-300'}`} />

            <CardHeader className="p-4 pb-2 pt-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1.5 w-full pr-8">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[9px] font-black tracking-widest border-2 rounded-none px-1.5 h-5 ${tier.color}`}>
                                {tier.label}
                            </Badge>
                            {customer.isProspect && (
                                <Badge variant="outline" className="text-[9px] bg-blue-100 text-blue-800 border-2 border-blue-200 rounded-none px-1.5 h-5 font-bold tracking-wider">
                                    PROSPECT
                                </Badge>
                            )}
                        </div>
                        <h3 className="font-black text-lg uppercase leading-tight line-clamp-2 min-h-[3rem] group-hover:text-blue-600 transition-colors">
                            {customer.name}
                        </h3>
                        <div className="flex flex-wrap items-center justify-between w-full gap-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 font-mono bg-zinc-100 px-1.5 py-0.5 border border-zinc-200 border-dashed">
                                <Building2 className="h-3 w-3" />
                                {customer.code}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-zinc-400">
                                {customer.customerType === 'COMPANY' ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                {customer.customerType}
                            </div>
                        </div>
                    </div>

                    <div className="absolute top-4 right-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-black hover:text-white rounded-none">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none w-48">
                                <DropdownMenuLabel className="font-black uppercase text-xs">Aksi Cepat</DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-black" />
                                <DropdownMenuItem asChild className="focus:bg-zinc-100 focus:font-bold cursor-pointer rounded-none">
                                    <Link href={`/sales/customers/${customer.id}`}>View Profile</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="focus:bg-zinc-100 focus:font-bold cursor-pointer rounded-none">Edit Data</DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600 focus:bg-red-50 focus:text-red-700 font-bold cursor-pointer rounded-none">Suspend Account</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 space-y-4">
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 border-2 border-zinc-100 bg-zinc-50/50">
                        <p className="text-[9px] uppercase font-black tracking-wider text-zinc-400 mb-1">Total Revenue</p>
                        <p className="font-black text-sm tracking-tight truncate" title={new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(customer.totalOrderValue)}>
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact' }).format(customer.totalOrderValue)}
                        </p>
                    </div>
                    <div className="p-2.5 border-2 border-zinc-100 bg-zinc-50/50 relative overflow-hidden">
                        <div className={`absolute top-0 right-0 w-1.5 h-1.5 ${getStatusColor(customer.creditStatus)}`} />
                        <p className="text-[9px] uppercase font-black tracking-wider text-zinc-400 mb-1">Credit Status</p>
                        <p className="font-bold text-xs flex items-center gap-1.5 uppercase">
                            {customer.creditStatus === 'HOLD' && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                            <span className={customer.creditStatus === 'HOLD' ? 'text-red-600' : 'text-zinc-900'}>
                                {customer.creditStatus === 'GOOD' ? 'LANCAR' : customer.creditStatus}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 text-xs border-t-2 border-dashed border-zinc-100 pt-3">
                    <div className="flex items-center gap-2.5 text-zinc-600 font-medium truncate" title={customer.city}>
                        <MapPin className="h-3.5 w-3.5 text-black shrink-0" />
                        <span className="truncate">{customer.city || "Kota belum diisi"}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-zinc-600 font-medium truncate" title={customer.phone}>
                        <Phone className="h-3.5 w-3.5 text-black shrink-0" />
                        <span className="truncate">{customer.phone || "-"}</span>
                    </div>
                </div>

                {/* Next Action */}
                <div className="border-2 border-black bg-zinc-50 p-2.5 space-y-2">
                    <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-amber-500 fill-amber-500" />
                        <p className="text-[9px] uppercase font-black tracking-wider text-zinc-400">Recommendation</p>
                    </div>
                    <p className="text-[10px] font-bold leading-tight text-zinc-700 min-h-[2.5em] line-clamp-2">
                        {nextAction.description}
                    </p>
                    <Button asChild size="sm" className="h-7 w-full text-[9px] font-black uppercase bg-black text-white hover:bg-zinc-800 rounded-none tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-y-[1px] transition-all">
                        <Link href={nextAction.href}>{nextAction.label}</Link>
                    </Button>
                </div>
            </CardContent>

            <CardFooter className="p-0 border-t-2 border-black divide-x-2 divide-black mt-auto">
                <Button
                    variant="ghost"
                    className="flex-1 h-9 rounded-none hover:bg-emerald-50 hover:text-emerald-700 text-[10px] font-black uppercase rounded-bl-none"
                    onClick={handleWhatsappClick}
                    disabled={!buildWhatsappPhone(customer.phone || "")}
                >
                    <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> WA
                </Button>
                <Button asChild variant="ghost" className="flex-1 h-9 rounded-none hover:bg-blue-50 hover:text-blue-700 text-[10px] font-black uppercase">
                    <Link href={`/sales/quotations/new?customerId=${customer.id}`}>
                        <FileText className="h-3.5 w-3.5 mr-1.5" /> Quote
                    </Link>
                </Button>
                <Button asChild variant="ghost" className="flex-1 h-9 rounded-none hover:bg-zinc-900 hover:text-white text-[10px] font-black uppercase text-zinc-900 rounded-br-none hover:fill-white">
                    <Link href={`/sales/orders/new?customerId=${customer.id}`}>
                        <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Order
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    )
}
