"use client"

import { useState } from "react"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Search,
    Filter,
    MoreHorizontal,
    Edit,
    Eye,
    Plus,
    FileText,
    Send,
    AlertTriangle,
    CheckCircle,
    Clock,
    ArrowRight,
    Building2,
    Printer,
    Mail
} from "lucide-react"
import Link from "next/link"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"
import { QuotationKanban } from "@/components/sales/quotation-kanban"

// Helper functions (moved from page.tsx)
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount)
}

const isExpiringSoon = (validUntil: string) => {
    const today = new Date()
    const expiryDate = new Date(validUntil)
    const diffTime = expiryDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= 3 && diffDays > 0
}

interface QuotationsClientProps {
    initialQuotations: any[]
}

export default function QuotationsClient({ initialQuotations }: QuotationsClientProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus, setFilterStatus] = useState("all")
    const [filterSalesPerson, setFilterSalesPerson] = useState("all")

    // Filter quotations
    const filteredQuotations = initialQuotations.filter(quotation => {
        const matchesSearch = quotation.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            quotation.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (quotation.customerRef && quotation.customerRef.toLowerCase().includes(searchTerm.toLowerCase()))
        const matchesStatus = filterStatus === "all" || quotation.status === filterStatus
        const matchesSalesPerson = filterSalesPerson === "all" || quotation.salesPerson === filterSalesPerson
        return matchesSearch && matchesStatus && matchesSalesPerson
    })

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Manajemen Penawaran</h2>
                    <p className="text-muted-foreground">
                        Buat dan kelola penawaran harga kain, benang, dan jasa
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" asChild>
                        <Link href="/sales/quotations/templates">
                            <FileText className="mr-2 h-4 w-4" />
                            Template
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/sales/quotations/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Buat Penawaran
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Stats Cards - Ritchie Minimal */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <CardDescription className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Pipe Value (Sent)</CardDescription>
                                <CardTitle className="text-3xl font-black">
                                    {formatCurrency(initialQuotations.filter(q => q.status === 'SENT').reduce((acc, q) => acc + q.total, 0)).replace(/\D00$/, '')}
                                </CardTitle>
                            </div>
                            <div className="h-8 w-8 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
                                <IconTrendingUp className="h-4 w-4 text-blue-600" />
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <CardDescription className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Win Rate</CardDescription>
                                <CardTitle className="text-3xl font-black text-emerald-600">
                                    {initialQuotations.length > 0 ? Math.round((initialQuotations.filter(q => q.status === 'ACCEPTED' || q.status === 'CONVERTED').length / initialQuotations.length) * 100) : 0}%
                                </CardTitle>
                            </div>
                            <div className="h-8 w-8 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <CardDescription className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Active Deals</CardDescription>
                                <CardTitle className="text-3xl font-black text-black">
                                    {initialQuotations.filter(q => q.status === 'SENT' || q.status === 'DRAFT').length}
                                </CardTitle>
                            </div>
                            <Badge variant="outline" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                Target: 15
                            </Badge>
                        </div>
                    </CardHeader>
                </Card>

                <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-red-50">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <CardDescription className="font-bold text-xs uppercase tracking-wider text-red-800">Stalled / Expiring</CardDescription>
                                <CardTitle className="text-3xl font-black text-red-600">
                                    {initialQuotations.filter(q => q.status === 'EXPIRED' || isExpiringSoon(q.validUntil)).length}
                                </CardTitle>
                            </div>
                            <div className="h-8 w-8 rounded bg-white border border-red-200 flex items-center justify-center">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            </div>

            {/* Kanban Board Area */}
            <div className="flex items-center space-x-4 mb-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search deals..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold">
                        <Filter className="mr-2 h-4 w-4" /> Filter by Sales
                    </Button>
                    <Button className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-bold bg-black text-white hover:bg-zinc-800" asChild>
                        <Link href="/sales/quotations/new">
                            <Plus className="mr-2 h-4 w-4" /> New Quote
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="h-full">
                <QuotationKanban quotations={filteredQuotations} />
            </div>

            {filteredQuotations.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-muted-foreground font-medium">No quotations match your filter.</p>
                </div>
            )}
        </div>
    )
}
