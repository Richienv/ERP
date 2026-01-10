"use client"

import { useState } from "react"
import {
    Search,
    Plus,
    Filter,
    MoreVertical,
    Phone,
    Mail,
    MapPin,
    Star,
    ExternalLink,
    Building2,
    BadgeCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Mock Vendors Data
const vendors = [
    {
        id: 1,
        name: "PT Textile Sejahtera",
        category: "Main Supplier",
        status: "Strategic",
        rating: 5,
        contact: "Bapak Rahardjo",
        phone: "+62 812 3456 7890",
        email: "supply@textile-sejahtera.com",
        address: "Kawasan Industri Jababeka II, Cikarang",
        totalSpend: "2.5M",
        activeOrders: 3,
        color: "bg-emerald-500",
        logo: "TS"
    },
    {
        id: 2,
        name: "Global Chemical Indo",
        category: "Chemicals",
        status: "Approved",
        rating: 4,
        contact: "Ibu Sarah",
        phone: "+62 811 9876 5432",
        email: "sales@globalchem.co.id",
        address: "Jl. Raya Serang Km 12, Tangerang",
        totalSpend: "850jt",
        activeOrders: 1,
        color: "bg-blue-500",
        logo: "GC"
    },
    {
        id: 3,
        name: "CV Benang Emas",
        category: "Accessories",
        status: "Review Needed",
        rating: 3,
        contact: "Admin Sales",
        phone: "+62 21 5555 1234",
        email: "order@benangemas.com",
        address: "Pasar Baru Trade Center, Bandung",
        totalSpend: "120jt",
        activeOrders: 0,
        color: "bg-amber-500",
        logo: "BE"
    },
    {
        id: 4,
        name: "Zhejiang Fabrics Ltd",
        category: "Import",
        status: "Strategic",
        rating: 5,
        contact: "Mr. Chen",
        phone: "+86 139 0000 1111",
        email: "chen@zhejiangfabrics.cn",
        address: "Shaoxing, Zhejiang, China",
        totalSpend: "4.2M",
        activeOrders: 5,
        color: "bg-purple-500",
        logo: "ZF"
    },
    {
        id: 5,
        name: "Mitra Pack",
        category: "Logistics",
        status: "Approved",
        rating: 4,
        contact: "Customer Service",
        phone: "+62 21 8888 9999",
        email: "cs@mitrapack.co.id",
        address: "Pergudangan Pluit, Jakarta Utara",
        totalSpend: "350jt",
        activeOrders: 2,
        color: "bg-indigo-500",
        logo: "MP"
    }
]

export default function VendorsPage() {
    const [searchTerm, setSearchTerm] = useState("")

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        <Building2 className="h-8 w-8" /> Pemasok
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Database dan manajemen relasi vendor aktif.</p>
                </div>
                <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide transition-all active:translate-y-1 active:shadow-none">
                    <Plus className="mr-2 h-4 w-4" /> Vendor Baru
                </Button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 bg-white p-2 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Cari nama vendor..." className="pl-9 border-black focus-visible:ring-black font-medium" />
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="border-black font-bold uppercase hover:bg-zinc-100">
                        <Filter className="mr-2 h-4 w-4" /> Filter
                    </Button>
                </div>
            </div>

            {/* Vendors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vendors.map((vendor) => (
                    <Card key={vendor.id} className="group relative border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden flex flex-col">
                        {/* Status Stripe */}
                        <div className={`h-2 w-full ${vendor.color} border-b border-black/10`} />

                        <CardHeader className="pb-2 flex-row gap-4 items-start space-y-0">
                            <Avatar className="h-14 w-14 border-2 border-black shadow-sm">
                                <AvatarFallback className="font-black bg-zinc-100 text-black">{vendor.logo}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-[10px] font-bold uppercase border-black bg-zinc-50">{vendor.category}</Badge>
                                    {vendor.status === 'Strategic' && <BadgeCheck className="h-4 w-4 text-blue-500" />}
                                </div>
                                <CardTitle className="text-xl font-black uppercase mt-1 truncate leading-tight" title={vendor.name}>{vendor.name}</CardTitle>
                                <div className="flex items-center gap-1 mt-1">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className={`h-3 w-3 ${i < vendor.rating ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200"}`} />
                                    ))}
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-4 flex-1">
                            <div className="text-sm space-y-2 py-2 border-y border-dashed border-zinc-200">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <MapPin className="h-3.5 w-3.5" />
                                    <span className="truncate">{vendor.address}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span className="truncate">{vendor.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span className="truncate">{vendor.phone}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 border border-black/10 rounded bg-zinc-50">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Spend</p>
                                    <p className="text-lg font-black">{vendor.totalSpend}</p>
                                </div>
                                <div className="p-2 border border-black/10 rounded bg-zinc-50">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Active Orders</p>
                                    <p className="text-lg font-black">{vendor.activeOrders}</p>
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter className="pt-4 border-t border-black bg-zinc-50 flex gap-2">
                            <Button variant="outline" className="flex-1 border-black font-bold uppercase text-xs shadow-sm hover:shadow-none bg-white">
                                History
                            </Button>
                            <Button variant="outline" className="flex-1 border-black font-bold uppercase text-xs shadow-sm hover:shadow-none bg-white">
                                Contact
                            </Button>
                            <Button variant="ghost" size="icon" className="border border-transparent hover:border-black hover:bg-white">
                                <ExternalLink className="h-4 w-4" />
                            </Button>
                        </CardFooter>
                    </Card>
                ))}

                {/* Add Vendor Placeholder */}
                <button className="group relative flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 hover:border-black rounded-xl p-8 transition-colors h-full min-h-[300px] bg-zinc-50 hover:bg-white">
                    <div className="h-16 w-16 bg-white border border-zinc-200 group-hover:border-black rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <Plus className="h-8 w-8 text-zinc-400 group-hover:text-black" />
                    </div>
                    <h3 className="text-lg font-black text-zinc-400 group-hover:text-black uppercase">Tambah Vendor</h3>
                </button>

            </div>
        </div>
    )
}
