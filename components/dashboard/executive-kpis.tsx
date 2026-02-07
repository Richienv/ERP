// ... imports
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Truck, Package, ShoppingCart, Users, Factory } from "lucide-react"
import Link from "next/link"
import { PengadaanCard } from "@/components/dashboard/pengadaan-card"

import { formatCompactNumber, formatIDR } from "@/lib/utils"

interface ExecutiveKPIsProps {
    procurement?: {
        activeCount: number
        delays: Array<{ id: string, number: string, supplierName: string, productName: string, daysLate: number }>
        pendingApproval: Array<{
            id: string
            number: string
            supplier: { name: string, email: string | null, phone: string | null }
            totalAmount: number
            netAmount: number
            itemCount: number
            items: Array<{ productName: string, productCode: string, quantity: number }>
        }>
    }
    inventory?: {
        auditDate?: Date
        warehouseName?: string
        deadStockValue?: number
    }
    production?: {
        activeWorkOrders: number
        totalProduction: number
        efficiency: number
    }
    hr?: {
        totalSalary: number
        lateEmployees: Array<{ id: string, name: string, department: string, checkInTime: string }>
        pendingLeaves: number
    }
    sales?: {
        totalRevenue: number
        totalOrders: number
        activeOrders: number
        recentOrders: any[]
    }
}

export function ExecutiveKPIs({ procurement, inventory, production, hr, sales }: ExecutiveKPIsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* 1. PENGADAAN (Procurement) */}
            {procurement ? (
                <PengadaanCard
                    pendingApproval={procurement.pendingApproval}
                    activeCount={procurement.activeCount}
                />
            ) : (
                <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-white h-full">
                    <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                            <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-blue-600" /> Pengadaan</span>
                            <Skeleton className="h-5 w-16" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <Skeleton className="h-9 w-24 mb-2" />
                        <Skeleton className="h-4 w-32 mb-4" />
                        <Skeleton className="h-20 w-full mb-4" />
                        <Skeleton className="h-8 w-full" />
                    </CardContent>
                </Card>
            )}

            {/* 2. GUDANG (Inventory) */}
            <Link href="/inventory">
                <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white cursor-pointer h-full">
                    <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                            <span className="flex items-center gap-2"><Package className="h-4 w-4 text-emerald-600" /> Gudang</span>
                            {!inventory ? <Skeleton className="h-5 w-16" /> : inventory.auditDate ? (
                                <span className="text-[10px] bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-black">AUDIT REQ</span>
                            ) : null}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-3xl font-black tracking-tight">
                            {inventory ? `Rp ${formatCompactNumber(inventory.deadStockValue || 0)}` : <Skeleton className="h-9 w-24" />}
                        </div>
                        <p className="text-xs font-bold text-zinc-400 mt-1 mb-4">Dead Stock Value (&gt;6 Mo)</p>

                        <div className="mb-4">
                            <p className="text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">Next Audit</p>
                            {inventory ? (
                                inventory.auditDate ? (
                                    <div className="text-xs font-bold">
                                        <p className="mb-1">{inventory.warehouseName}</p>
                                        <p className="text-amber-700">{new Date(inventory.auditDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                                    </div>
                                ) : (
                                    <p className="text-xs font-medium text-zinc-500">No scheduled audits</p>
                                )
                            ) : <Skeleton className="h-8 w-full" />}
                        </div>

                        <Button size="sm" variant="outline" className="w-full text-xs font-black uppercase tracking-wider h-8 border-2 border-black hover:bg-zinc-50">
                            View Inventory
                        </Button>
                    </CardContent>
                </Card>
            </Link>

            {/* 3. PENJUALAN (Sales) */}
            <Link href="/sales/orders">
                <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white cursor-pointer h-full">
                    <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                            <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-blue-600" /> Penjualan</span>
                            {sales ? (
                                <span className="text-[10px] bg-blue-100 text-blue-900 px-1 py-0.5 rounded font-black">ACTIVE</span>
                            ) : <Skeleton className="h-5 w-16" />}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-3xl font-black tracking-tight">{sales ? `Rp ${formatCompactNumber(sales.totalRevenue)}` : <Skeleton className="h-9 w-24" />}</div>
                        <p className="text-xs font-bold text-zinc-400 mt-1 mb-4">Revenue (MTD)</p>

                        <div className="space-y-1 mb-4">
                            <div className="flex justify-between text-xs font-bold">
                                <span>Active Orders</span>
                                <span>{sales ? sales.activeOrders : <Skeleton className="h-4 w-8 inline-block" />}</span>
                            </div>
                            {sales?.recentOrders?.[0] && (
                                <div className="flex justify-between text-xs font-bold">
                                    <span>Recent</span>
                                    <span className="text-blue-600 truncate max-w-[100px]">{sales.recentOrders[0].customer.split(' ')[0]}</span>
                                </div>
                            )}
                        </div>

                        <Button size="sm" variant="outline" className="w-full text-xs font-black uppercase tracking-wider h-8 border-2 border-black hover:bg-zinc-50">
                            View Orders
                        </Button>
                    </CardContent>
                </Card>
            </Link>

            {/* 4. KARYAWAN (HR) */}
            <Link href="/hcm">
                <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white cursor-pointer h-full">
                    <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                        <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-purple-600" /> Karyawan</span>
                            {!hr ? <Skeleton className="h-5 w-16" /> : null}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="text-3xl font-black tracking-tight">{hr ? formatCompactNumber(hr.totalSalary) : <Skeleton className="h-9 w-24" />}</div>
                        <p className="text-xs font-bold text-zinc-400 mt-1 mb-4">Est. Gaji Bulan Ini</p>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-blue-50 p-2 rounded border border-blue-100">
                                <p className="text-[10px] font-black uppercase text-blue-700 mb-1">Cuti Pending</p>
                                <div className="text-xl font-black text-blue-800">{hr ? hr.pendingLeaves : <Skeleton className="h-6 w-8" />}</div>
                            </div>
                            <div className="bg-red-50 p-2 rounded border border-red-100">
                                <p className="text-[10px] font-black uppercase text-red-700 mb-1">Terlambat</p>
                                {hr ? (
                                    hr.lateEmployees?.length ? (
                                        <ul className="text-xs font-bold text-red-800 space-y-0.5">
                                            {hr.lateEmployees.slice(0, 2).map((emp, i) => (
                                                <li key={i}>• {emp.name.split(' ')[0]}</li>
                                            ))}
                                            {hr.lateEmployees.length > 2 && <li>+ {hr.lateEmployees.length - 2} more</li>}
                                        </ul>
                                    ) : (
                                        <span className="text-[10px] text-zinc-500">None today</span>
                                    )
                                ) : <Skeleton className="h-8 w-full" />}
                            </div>
                        </div>

                        <Button size="sm" variant="outline" className="w-full text-xs font-black uppercase tracking-wider h-8 border-2 border-black hover:bg-purple-50">
                            View HR
                        </Button>
                    </CardContent>
                </Card>
            </Link>
        </div>
    )
}
