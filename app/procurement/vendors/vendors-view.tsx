"use client"

import { useState } from "react"
import {
    Search,
    Phone,
    Mail,
    MapPin,
    Star,
    Building2,
    BadgeCheck,
    TrendingUp,
    ShoppingCart,
    Users,
    AlertCircle,
    Tag,
    PhoneCall,
    CreditCard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { NewVendorDialog } from "@/components/procurement/new-vendor-dialog"
import { VendorActions } from "@/components/procurement/vendor-actions"
import { cn } from "@/lib/utils"

type Vendor = {
    id: string
    code: string
    name: string
    contactName: string | null
    contactTitle: string | null
    email: string | null
    phone: string | null
    picPhone: string | null
    officePhone: string | null
    address: string | null
    address2: string | null
    paymentTerm: string | null
    rating: number
    onTimeRate: number
    isActive: boolean
    totalOrders: number
    activeOrders: number
    categories: { id: string; code: string; name: string }[]
}

interface VendorsViewProps {
    initialVendors: Vendor[]
}

export function VendorsView({ initialVendors }: VendorsViewProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
    const [filterCategory, setFilterCategory] = useState<string>("ALL")

    const allCategories = Array.from(
        new Map(
            initialVendors.flatMap(v => v.categories || []).map(c => [c.id, c])
        ).values()
    )

    const filteredVendors = initialVendors.filter(vendor => {
        const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            vendor.code.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = filterStatus === "ALL" ||
            (filterStatus === "ACTIVE" && vendor.isActive) ||
            (filterStatus === "INACTIVE" && !vendor.isActive)
        const matchesCategory = filterCategory === "ALL" ||
            (vendor.categories || []).some(c => c.id === filterCategory)
        return matchesSearch && matchesStatus && matchesCategory
    })

    // Stats
    const totalVendors = initialVendors.length
    const activeVendors = initialVendors.filter(v => v.isActive).length
    const totalActiveOrders = initialVendors.reduce((sum, v) => sum + v.activeOrders, 0)
    const avgRating = initialVendors.length > 0
        ? (initialVendors.reduce((sum, v) => sum + v.rating, 0) / initialVendors.length).toFixed(1)
        : "0"

    const getVendorColor = (name: string) => {
        const colors = [
            "bg-emerald-500", "bg-blue-500", "bg-amber-500",
            "bg-purple-500", "bg-indigo-500", "bg-rose-500"
        ]
        return colors[name.length % colors.length]
    }

    const getInitials = (name: string) =>
        name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()

    return (
        <div className="mf-page">

            {/* ═══ COMMAND HEADER ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-indigo-400">
                    <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-indigo-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Pemasok
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Database dan manajemen relasi vendor aktif
                            </p>
                        </div>
                    </div>
                    <NewVendorDialog />
                </div>
            </div>

            {/* ═══ KPI PULSE STRIP ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Vendor</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">{totalVendors}</div>
                        <div className="text-[10px] font-bold text-indigo-600 mt-1">Semua pemasok</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <BadgeCheck className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Vendor Aktif</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">{activeVendors}</div>
                        <div className="text-[10px] font-bold text-emerald-600 mt-1">Dalam kerjasama</div>
                    </div>
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <ShoppingCart className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Order Aktif</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">{totalActiveOrders}</div>
                        <div className="text-[10px] font-bold text-amber-600 mt-1">PO berjalan</div>
                    </div>
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Star className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Rata-rata Rating</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">{avgRating}</div>
                        <div className="text-[10px] font-bold text-blue-600 mt-1">Dari 5.0</div>
                    </div>
                </div>
            </div>

            {/* ═══ SEARCH & FILTER BAR ═══ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="relative flex-1 max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari nama vendor atau kode..."
                            className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                        />
                    </div>
                    <div className="flex border-2 border-black">
                        {(["ALL", "ACTIVE", "INACTIVE"] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 ${
                                    filterStatus === s
                                        ? "bg-black text-white"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                {s === "ALL" ? "Semua" : s === "ACTIVE" ? "Aktif" : "Nonaktif"}
                            </button>
                        ))}
                    </div>
                    {allCategories.length > 0 && (
                        <div className="flex border-2 border-black">
                            <button
                                onClick={() => setFilterCategory("ALL")}
                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black ${
                                    filterCategory === "ALL" ? "bg-violet-600 text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                Semua Kategori
                            </button>
                            {allCategories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setFilterCategory(cat.id)}
                                    className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 ${
                                        filterCategory === cat.id ? "bg-violet-600 text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hidden md:block">
                        {filteredVendors.length} vendor
                    </div>
                </div>
            </div>

            {/* ═══ VENDOR GRID ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredVendors.map((vendor) => (
                    <div key={vendor.id} className="group bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all overflow-hidden flex flex-col">
                        {/* Color stripe */}
                        <div className={cn("h-1 w-full", getVendorColor(vendor.name))} />

                        {/* Header */}
                        <div className="px-4 py-3 flex items-start gap-3">
                            <Avatar className="h-10 w-10 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                <AvatarFallback className="font-black bg-zinc-100 dark:bg-zinc-800 text-xs">{getInitials(vendor.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-[9px] font-black uppercase border-black bg-zinc-50 dark:bg-zinc-800 tracking-widest">{vendor.code}</Badge>
                                    {vendor.paymentTerm && vendor.paymentTerm !== "CASH" && (
                                        <Badge className="text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-100">
                                            {vendor.paymentTerm.replace("_", " ")}
                                        </Badge>
                                    )}
                                    {vendor.rating >= 4 && <BadgeCheck className="h-3.5 w-3.5 text-blue-500" />}
                                    {!vendor.isActive && <span className="text-[9px] font-black uppercase tracking-widest text-red-500">Nonaktif</span>}
                                </div>
                                <h3 className="font-black text-sm uppercase mt-1 truncate leading-tight" title={vendor.name}>{vendor.name}</h3>
                                <div className="flex items-center gap-0.5 mt-1">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className={cn("h-3 w-3", i < vendor.rating ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200")} />
                                    ))}
                                </div>
                                {vendor.categories && vendor.categories.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                        {vendor.categories.map(cat => (
                                            <span key={cat.id} className="inline-flex items-center gap-0.5 px-1.5 py-0 bg-violet-100 text-violet-700 text-[9px] font-black uppercase tracking-wider border border-violet-200">
                                                <Tag className="h-2.5 w-2.5" />
                                                {cat.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="px-4 py-2 space-y-1.5 border-y border-zinc-100 dark:border-zinc-800 text-xs">
                            <div className="flex items-center gap-2 text-zinc-500">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{vendor.address || "-"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-zinc-500">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate">{vendor.email || "-"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-zinc-500">
                                <Phone className="h-3 w-3 shrink-0" />
                                <span className="truncate">{vendor.phone || "-"}</span>
                            </div>
                            {vendor.officePhone && (
                                <div className="flex items-center gap-2 text-zinc-500">
                                    <Building2 className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{vendor.officePhone}</span>
                                    <span className="text-[8px] font-black uppercase text-zinc-400">kantor</span>
                                </div>
                            )}
                            {vendor.contactName && (
                                <div className="flex items-center gap-2 text-zinc-500">
                                    <span className="text-[9px] font-black bg-zinc-100 dark:bg-zinc-800 px-1 border border-black">PIC</span>
                                    <span className="truncate">
                                        {vendor.contactTitle ? `${vendor.contactTitle} ` : ""}{vendor.contactName}
                                    </span>
                                </div>
                            )}
                            {vendor.picPhone && (
                                <div className="flex items-center gap-2 text-zinc-500">
                                    <PhoneCall className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{vendor.picPhone}</span>
                                    <span className="text-[8px] font-black uppercase text-zinc-400">HP PIC</span>
                                </div>
                            )}
                        </div>

                        {/* Stats */}
                        <div className="px-4 py-3 grid grid-cols-2 gap-2">
                            <div className="p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Total Orders</p>
                                <p className="text-lg font-black">{vendor.totalOrders}</p>
                            </div>
                            <div className="p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Active Orders</p>
                                <p className="text-lg font-black">{vendor.activeOrders}</p>
                            </div>
                        </div>

                        <VendorActions vendor={vendor} />
                    </div>
                ))}
            </div>

            {filteredVendors.length === 0 && (
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-12 text-center">
                    <Building2 className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tidak ada vendor yang ditemukan</p>
                </div>
            )}
        </div>
    )
}
