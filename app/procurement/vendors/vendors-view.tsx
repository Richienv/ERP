"use client"

import { useState } from "react"
import {
    Search,
    Filter,
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
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { NewVendorDialog } from "@/components/procurement/new-vendor-dialog"
import { VendorActions } from "@/components/procurement/vendor-actions"

// Type definition matching getVendors return type
type Vendor = {
    id: string
    code: string
    name: string
    contactName: string | null
    email: string | null
    phone: string | null
    address: string | null
    rating: number
    onTimeRate: number
    isActive: boolean
    totalOrders: number
    activeOrders: number
}

interface VendorsViewProps {
    initialVendors: Vendor[]
}

export function VendorsView({ initialVendors }: VendorsViewProps) {
    const [searchTerm, setSearchTerm] = useState("")

    // Filter vendors based on search
    const filteredVendors = initialVendors.filter(vendor =>
        vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Helper to generate consistent colors based on name
    const getVendorColor = (name: string) => {
        const colors = [
            "bg-emerald-500", "bg-blue-500", "bg-amber-500",
            "bg-purple-500", "bg-indigo-500", "bg-rose-500"
        ]
        const index = name.length % colors.length
        return colors[index]
    }

    // Helper to get initials
    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map(n => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
    }

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

                {/* New Vendor Dialog Button */}
                <NewVendorDialog />
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 bg-white p-2 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama vendor..."
                        className="pl-9 border-black focus-visible:ring-black font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="border-black font-bold uppercase hover:bg-zinc-100">
                        <Filter className="mr-2 h-4 w-4" /> Filter
                    </Button>
                </div>
            </div>

            {/* Vendors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredVendors.map((vendor) => (
                    <Card key={vendor.id} className="group relative border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden flex flex-col">
                        {/* Status Stripe */}
                        <div className={`h-2 w-full ${getVendorColor(vendor.name)} border-b border-black/10`} />

                        <CardHeader className="pb-2 flex-row gap-4 items-start space-y-0">
                            <Avatar className="h-14 w-14 border-2 border-black shadow-sm">
                                <AvatarFallback className="font-black bg-zinc-100 text-black">{getInitials(vendor.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-[10px] font-bold uppercase border-black bg-zinc-50">{vendor.code}</Badge>
                                    {vendor.rating >= 4 && <BadgeCheck className="h-4 w-4 text-blue-500" />}
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
                                    <span className="truncate">{vendor.address || "-"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span className="truncate">{vendor.email || "-"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span className="truncate">{vendor.phone || "-"}</span>
                                </div>
                                {vendor.contactName && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <span className="text-xs font-bold bg-zinc-100 px-1 rounded">PIC</span>
                                        <span className="truncate">{vendor.contactName}</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-2 border border-black/10 rounded bg-zinc-50">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Total Orders</p>
                                    <p className="text-lg font-black">{vendor.totalOrders}</p>
                                </div>
                                <div className="p-2 border border-black/10 rounded bg-zinc-50">
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Active Orders</p>
                                    <p className="text-lg font-black">{vendor.activeOrders}</p>
                                </div>
                            </div>
                        </CardContent>

                        <VendorActions vendor={vendor} />
                    </Card>
                ))}

                {/* Add Vendor Quick Access (Trigger Dialog) */}
                <div className="h-full min-h-[300px] flex">
                    <NewVendorDialog /> {/* Re-using dialog here but styled differently? Or just use the button in header? */}
                    {/* Actually, let's keep the placeholder card design but wrap it to trigger the dialog logic. 
                        Since NewVendorDialog handles its own trigger button, I'll extract the Dialog Content logic or 
                        just wrap a custom trigger.
                    */}
                </div>

                {/* 
                   Wait, NewVendorDialog has a fixed button trigger. 
                   I should refactor NewVendorDialog to accept a 'trigger' prop or just use `DialogTrigger` asChild
                   Let's assume standard behavior for now to save time, and maybe create a second instance of the dialog 
                   with a different trigger for this card if needed. 
                   Actually, looking at `new-vendor-dialog.tsx`, it renders a specific <Button>.
                   
                   Refinement: The plan for Step 2405 included a big dashed placeholder card at the end of the list.
                   I will make NewVendorDialog accept a custom trigger or just render a second one here.
                   For now, let's just render the grid. The big dashed card is nice but maybe redundant with the header button.
                   I'll omit the big dashed card for now to keep it clean, or I can add it back later if requested.
                 */}
            </div>

            {filteredVendors.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                    <p>Tidak ada vendor yang ditemukan.</p>
                </div>
            )}
        </div>
    )
}
