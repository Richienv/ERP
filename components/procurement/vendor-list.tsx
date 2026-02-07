"use client"

import { useState } from "react"
import { Search, Plus, Filter, Phone, Mail, MapPin, Star, ExternalLink, Building2, BadgeCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { createVendor } from "@/lib/actions/procurement"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface Vendor {
    id: string
    name: string
    category: string
    status: string
    rating: number
    contact: string
    phone: string
    email: string
    address: string
    totalSpend: string
    activeOrders: number
    color: string
    logo: string
}

export function VendorList({ initialData }: { initialData: Vendor[] }) {
    const [searchTerm, setSearchTerm] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    // New Vendor Form State
    const [newVendor, setNewVendor] = useState({
        name: "",
        code: "",
        contactName: "",
        email: "",
        phone: "",
        address: ""
    })

    const filtered = initialData.filter(v =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.contact.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleCreate = async () => {
        if (!newVendor.name || !newVendor.code) {
            toast.error("Name and Code are required")
            return
        }

        setIsSubmitting(true)
        try {
            const result = await createVendor(newVendor)
            if (result.success) {
                toast.success("Vendor Created")
                setIsCreateOpen(false)
                setNewVendor({ name: "", code: "", contactName: "", email: "", phone: "", address: "" }) // Reset
                router.refresh()
            } else {
                toast.error(result.error || "Failed to create vendor")
            }
        } catch (e) {
            toast.error("Error creating vendor")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="space-y-6">

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-2 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari nama vendor..."
                        className="pl-9 border-black focus-visible:ring-black font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-sm uppercase font-bold tracking-wide">
                                <Plus className="mr-2 h-4 w-4" /> Vendor Baru
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="uppercase font-black flex items-center gap-2">
                                    <Building2 className="h-5 w-5" /> Add New Vendor
                                </DialogTitle>
                                <DialogDescription>Register a new supplier in the system.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Company Name *</Label>
                                        <Input value={newVendor.name} onChange={e => setNewVendor({ ...newVendor, name: e.target.value })} placeholder="PT..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Code *</Label>
                                        <Input value={newVendor.code} onChange={e => setNewVendor({ ...newVendor, code: e.target.value })} placeholder="VEND-001" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Contact Person</Label>
                                        <Input value={newVendor.contactName} onChange={e => setNewVendor({ ...newVendor, contactName: e.target.value })} placeholder="Mr. Name" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Phone</Label>
                                        <Input value={newVendor.phone} onChange={e => setNewVendor({ ...newVendor, phone: e.target.value })} placeholder="+62..." />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input value={newVendor.email} onChange={e => setNewVendor({ ...newVendor, email: e.target.value })} placeholder="sales@vendor.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Address</Label>
                                    <Input value={newVendor.address} onChange={e => setNewVendor({ ...newVendor, address: e.target.value })} placeholder="Full Address" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreate} disabled={isSubmitting} className="bg-black text-white">
                                    {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Create Vendor"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Vendors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((vendor) => (
                    <Card key={vendor.id} className="group relative border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden flex flex-col">
                        <div className={`h-2 w-full ${vendor.color} border-b border-black/10`} />

                        <CardHeader className="pb-2 flex-row gap-4 items-start space-y-0">
                            <Avatar className="h-14 w-14 border-2 border-black shadow-sm">
                                <AvatarFallback className="font-black bg-zinc-100 text-black">{vendor.logo}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="text-[10px] font-bold uppercase border-black bg-zinc-50">{vendor.category}</Badge>
                                    {vendor.rating >= 4.5 && <BadgeCheck className="h-4 w-4 text-blue-500" />}
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
                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{vendor.address}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{vendor.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5 shrink-0" />
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
                        </CardFooter>
                    </Card>
                ))}

                {filtered.length === 0 && (
                    <div className="col-span-full text-center p-12 border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50">
                        <p className="text-muted-foreground font-bold">No vendors found.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
