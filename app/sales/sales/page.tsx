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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Search,
    Filter,
    MoreHorizontal,
    Eye,
    FileText,
    DollarSign,
    Calendar,
    CheckCircle,
    AlertCircle,
    Download,
    Printer,
    CreditCard
} from "lucide-react"
import Link from "next/link"
import { IconTrendingUp, IconTrendingDown } from "@tabler/icons-react"

// Mock data for sales invoices - Textile Factory Context
const mockInvoices = [
    {
        id: '1',
        invoiceNumber: 'INV-2411-001',
        salesOrderNumber: 'SO-2411-001',
        customer: {
            id: '1',
            name: 'PT. Garment Indah Jaya',
            code: 'CUST-001'
        },
        invoiceDate: '2024-11-20',
        dueDate: '2024-12-20',
        paidDate: null,
        paymentTerm: 'NET_30',
        status: 'UNPAID',
        subtotal: 150000000,
        taxAmount: 16500000,
        total: 166500000,
        paidAmount: 0,
        itemCount: 3,
        salesPerson: 'Ahmad Setiawan',
        notes: "Tagihan Batch 1 - Cotton Combed"
    },
    {
        id: '2',
        invoiceNumber: 'INV-2411-002',
        salesOrderNumber: 'SO-2411-002',
        customer: {
            id: '2',
            name: 'CV. Tekstil Makmur',
            code: 'CUST-002'
        },
        invoiceDate: '2024-11-18',
        dueDate: '2024-12-03',
        paidDate: '2024-11-19',
        paymentTerm: 'NET_15',
        status: 'PAID',
        subtotal: 85000000,
        taxAmount: 9350000,
        total: 94350000,
        paidAmount: 94350000,
        itemCount: 2,
        salesPerson: 'Siti Rahmawati',
        notes: "Lunas - Jasa Celup"
    },
    {
        id: '3',
        invoiceNumber: 'INV-2411-003',
        salesOrderNumber: 'SO-2411-003',
        customer: {
            id: '3',
            name: 'Boutique Fashion A',
            code: 'CUST-003'
        },
        invoiceDate: '2024-11-15',
        dueDate: '2024-11-15',
        paidDate: '2024-11-15',
        paymentTerm: 'CASH',
        status: 'PAID',
        subtotal: 52000000,
        taxAmount: 5720000,
        total: 57720000,
        paidAmount: 57720000,
        itemCount: 1,
        salesPerson: 'Budi Prasetyo',
        notes: "Cash - Kain Rayon"
    },
    {
        id: '4',
        invoiceNumber: 'INV-2411-004',
        salesOrderNumber: 'SO-2410-008',
        customer: {
            id: '4',
            name: 'PT. Mode Nusantara',
            code: 'CUST-004'
        },
        invoiceDate: '2024-10-25',
        dueDate: '2024-11-25',
        paidDate: null,
        paymentTerm: 'NET_30',
        status: 'OVERDUE',
        subtotal: 120000000,
        taxAmount: 13200000,
        total: 133200000,
        paidAmount: 50000000,
        itemCount: 4,
        salesPerson: 'Dewi Kartika',
        notes: "Partial payment received"
    },
    {
        id: '5',
        invoiceNumber: 'INV-2411-005',
        salesOrderNumber: 'SO-2411-005',
        customer: {
            id: '5',
            name: 'UD. Kain Sejahtera',
            code: 'CUST-005'
        },
        invoiceDate: '2024-11-21',
        dueDate: '2024-12-21',
        paidDate: null,
        paymentTerm: 'NET_30',
        status: 'UNPAID',
        subtotal: 45000000,
        taxAmount: 4950000,
        total: 49950000,
        paidAmount: 0,
        itemCount: 2,
        salesPerson: 'Ahmad Setiawan',
        notes: "Tagihan Kain Perca"
    }
]

// Get invoice status badge
const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
        case 'PAID':
            return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">Lunas</Badge>
        case 'UNPAID':
            return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">Belum Bayar</Badge>
        case 'PARTIAL':
            return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">Parsial</Badge>
        case 'OVERDUE':
            return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">Jatuh Tempo</Badge>
        default:
            return <Badge variant="outline">Unknown</Badge>
    }
}

// Format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount)
}

// Format date
const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SalesPage() {
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus, setFilterStatus] = useState("all")

    // Filter invoices
    const filteredInvoices = mockInvoices.filter(invoice => {
        const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.salesOrderNumber.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesStatus = filterStatus === "all" || invoice.status === filterStatus
        return matchesSearch && matchesStatus
    })

    const salesStats = {
        totalInvoices: mockInvoices.length,
        totalRevenue: mockInvoices.reduce((sum, inv) => sum + inv.total, 0),
        paidInvoices: mockInvoices.filter(inv => inv.status === 'PAID').length,
        outstandingAmount: mockInvoices.reduce((sum, inv) => sum + (inv.total - inv.paidAmount), 0),
        monthlyGrowth: 12.5
    }

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            {/* Header */}
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Faktur Penjualan</h2>
                    <p className="text-muted-foreground">
                        Kelola tagihan, pembayaran, dan piutang pelanggan
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Ekspor Laporan
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
                <Card className="@container/card">
                    <CardHeader>
                        <CardDescription>Total Tagihan</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {salesStats.totalInvoices}
                        </CardTitle>
                        <CardAction>
                            <Badge variant="outline">
                                <FileText className="mr-1 size-3" />
                                Bulan Ini
                            </Badge>
                        </CardAction>
                    </CardHeader>
                    <CardFooter className="flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium">
                            Invoice Terbit <Calendar className="size-4" />
                        </div>
                        <div className="text-muted-foreground">
                            Total dokumen tagihan
                        </div>
                    </CardFooter>
                </Card>

                <Card className="@container/card">
                    <CardHeader>
                        <CardDescription>Total Revenue</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-green-600">
                            {formatCurrency(salesStats.totalRevenue).replace(/\D00$/, '')}
                        </CardTitle>
                        <CardAction>
                            <Badge variant="outline" className="border-green-600 text-green-600">
                                <IconTrendingUp />
                                +{salesStats.monthlyGrowth}%
                            </Badge>
                        </CardAction>
                    </CardHeader>
                    <CardFooter className="flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium text-green-600">
                            Omset Penjualan <DollarSign className="size-4" />
                        </div>
                        <div className="text-muted-foreground">
                            Total nilai faktur
                        </div>
                    </CardFooter>
                </Card>

                <Card className="@container/card">
                    <CardHeader>
                        <CardDescription>Pembayaran Diterima</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-blue-600">
                            {salesStats.paidInvoices}
                        </CardTitle>
                        <CardAction>
                            <Badge variant="outline" className="border-blue-600 text-blue-600">
                                <CheckCircle className="mr-1 size-3" />
                                Lunas
                            </Badge>
                        </CardAction>
                    </CardHeader>
                    <CardFooter className="flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium text-blue-600">
                            Cash Flow Masuk <CreditCard className="size-4" />
                        </div>
                        <div className="text-muted-foreground">
                            Invoice lunas bulan ini
                        </div>
                    </CardFooter>
                </Card>

                <Card className="@container/card">
                    <CardHeader>
                        <CardDescription>Piutang (Outstanding)</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-red-600">
                            {formatCurrency(salesStats.outstandingAmount).replace(/\D00$/, '')}
                        </CardTitle>
                        <CardAction>
                            <Badge variant="outline" className="border-red-600 text-red-600">
                                <AlertCircle className="mr-1 size-3" />
                                Belum Bayar
                            </Badge>
                        </CardAction>
                    </CardHeader>
                    <CardFooter className="flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium text-red-600">
                            Perlu Penagihan <IconTrendingDown className="size-4" />
                        </div>
                        <div className="text-muted-foreground">
                            Total tagihan belum lunas
                        </div>
                    </CardFooter>
                </Card>
            </div>

            {/* Invoices Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Daftar Faktur & Pembayaran</CardTitle>
                    <CardDescription>
                        Monitoring status pembayaran dan jatuh tempo invoice
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-4 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nomor invoice, customer, atau SO..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    <Filter className="mr-2 h-4 w-4" />
                                    Status: {filterStatus === "all" ? "Semua" : filterStatus}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Filter Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setFilterStatus("all")}>
                                    Semua Status
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterStatus("PAID")}>
                                    Lunas
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterStatus("UNPAID")}>
                                    Belum Bayar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setFilterStatus("OVERDUE")}>
                                    Jatuh Tempo
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Invoice Table */}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>No. Invoice</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead className="text-center">Tgl Invoice</TableHead>
                                    <TableHead className="text-center">Jatuh Tempo</TableHead>
                                    <TableHead className="text-center">Total Tagihan</TableHead>
                                    <TableHead className="text-center">Sisa Tagihan</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredInvoices.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-medium">
                                            <div className="space-y-1">
                                                <div className="flex items-center">
                                                    <FileText className="mr-2 h-3 w-3 text-muted-foreground" />
                                                    {invoice.invoiceNumber}
                                                </div>
                                                <div className="text-xs text-muted-foreground ml-5">
                                                    Ref: {invoice.salesOrderNumber}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{invoice.customer.name}</div>
                                            <div className="text-xs text-muted-foreground">{invoice.paymentTerm}</div>
                                        </TableCell>
                                        <TableCell className="text-center text-sm">
                                            {formatDate(invoice.invoiceDate)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className={`text-sm ${invoice.status === 'OVERDUE' ? 'text-red-600 font-medium' : ''}`}>
                                                {formatDate(invoice.dueDate)}
                                                {invoice.status === 'OVERDUE' && (
                                                    <div className="text-[10px] text-red-600 flex items-center justify-center mt-0.5">
                                                        <AlertCircle className="h-3 w-3 mr-1" /> Overdue
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="text-sm font-bold">{formatCurrency(invoice.total).replace(/\D00$/, '')}</div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="text-sm text-muted-foreground">
                                                {formatCurrency(invoice.total - invoice.paidAmount).replace(/\D00$/, '')}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {getInvoiceStatusBadge(invoice.status)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Buka menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/sales/invoices/${invoice.id}`}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            Lihat Detail
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    {invoice.status !== 'PAID' && (
                                                        <DropdownMenuItem>
                                                            <CreditCard className="mr-2 h-4 w-4" />
                                                            Catat Pembayaran
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem>
                                                        <Printer className="mr-2 h-4 w-4" />
                                                        Cetak Invoice
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem>
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Download PDF
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {filteredInvoices.length === 0 && (
                        <div className="text-center py-4">
                            <p className="text-muted-foreground">Tidak ada invoice yang ditemukan</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}