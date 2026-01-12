"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Truck, Package, ShoppingCart, Users } from "lucide-react"

export function ExecutiveKPIs() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* 1. PENGADAAN (Procurement - Detailed List) */}
            <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white">
                <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                        <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-blue-600" /> Pengadaan</span>
                        <span className="text-[10px] bg-zinc-100 text-zinc-900 px-1 py-0.5 rounded font-black">2 DELAYS</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-3xl font-black tracking-tight">12 PO</div>
                    <p className="text-xs font-bold text-zinc-400 mt-1 mb-4">Active Orders</p>

                    <div className="mb-4">
                        <p className="text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">Critical Delays (Material)</p>
                        <ul className="space-y-1">
                            <li className="flex justify-between text-xs font-bold">
                                <span>• Cotton 30s (Vendor A)</span>
                                <span className="text-red-600">Late 5d</span>
                            </li>
                            <li className="flex justify-between text-xs font-medium text-zinc-600">
                                <span>• Dye Red (Vendor B)</span>
                                <span>Late 2d</span>
                            </li>
                        </ul>
                    </div>

                    <Button size="sm" variant="outline" className="w-full text-xs font-black uppercase tracking-wider h-8 border-2 border-black hover:bg-zinc-50">
                        Switch Vendor
                    </Button>
                </CardContent>
            </Card>

            {/* 2. GUDANG (Inventory - Detailed List) */}
            <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white">
                <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                        <span className="flex items-center gap-2"><Package className="h-4 w-4 text-emerald-600" /> Gudang</span>
                        <span className="text-[10px] bg-zinc-100 text-zinc-900 px-1 py-0.5 rounded font-black">AUDIT REQ</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-3xl font-black tracking-tight">Rp 250 Jt</div>
                    <p className="text-xs font-bold text-zinc-400 mt-1 mb-4">Dead Stock Value (&gt;6 Mo)</p>

                    <div className="mb-4">
                        <p className="text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider">Stagnant Items</p>
                        <ul className="space-y-1">
                            <li className="flex justify-between text-xs font-bold">
                                <span>• Neon Fabric</span>
                                <span>1,200 m</span>
                            </li>
                            <li className="flex justify-between text-xs font-medium text-zinc-600">
                                <span>• Poly Grade B</span>
                                <span>800 m</span>
                            </li>
                            <li className="flex justify-between text-xs font-medium text-zinc-600">
                                <span>• Buttons (Old)</span>
                                <span>50 kg</span>
                            </li>
                        </ul>
                    </div>

                    <Button size="sm" variant="outline" className="w-full text-xs font-black uppercase tracking-wider h-8 border-2 border-black hover:bg-zinc-50">
                        Flash Sale (50%)
                    </Button>
                </CardContent>
            </Card>

            {/* 3. PENJUALAN (Sales) */}
            <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white">
                <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                        <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-orange-600" /> Penjualan</span>
                        <span className="text-[10px] bg-green-100 text-green-700 px-1 py-0.5 rounded font-black">+15%</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-3xl font-black tracking-tight">Rp 2.4 M</div>
                    <p className="text-xs font-bold text-zinc-400 mt-1 mb-4">Pendapatan (Jan)</p>

                    <div className="space-y-1 mb-4">
                        <p className="text-[10px] font-black uppercase text-zinc-400">Top Contributors</p>
                        <div className="flex justify-between text-xs font-bold">
                            <span>1. PT. Maju Jaya</span>
                            <span>Rp 450jt</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold">
                            <span>2. CV. Tekstil B</span>
                            <span>Rp 320jt</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold">
                            <span>3. Toko Kain C</span>
                            <span>Rp 150jt</span>
                        </div>
                    </div>

                    <Button size="sm" variant="outline" className="w-full text-xs font-black uppercase tracking-wider h-8 border-2 border-black hover:bg-orange-50">
                        Laporan Sales
                    </Button>
                </CardContent>
            </Card>

            {/* 4. KARYAWAN (HR) */}
            <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all bg-white">
                <CardHeader className="pb-2 border-b-2 border-dashed border-zinc-200">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                        <span className="flex items-center gap-2"><Users className="h-4 w-4 text-purple-600" /> Karyawan</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-3xl font-black tracking-tight">Rp 450 Jt</div>
                    <p className="text-xs font-bold text-zinc-400 mt-1 mb-4">Est. Gaji Bulan Ini</p>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-green-50 p-2 rounded border border-green-100">
                            <p className="text-[10px] font-black uppercase text-green-700 mb-1">Bonus (Top Perf.)</p>
                            <ul className="text-xs font-bold text-green-800 space-y-0.5">
                                <li>• Susi (Sales)</li>
                                <li>• Rina (Admin)</li>
                                <li>• Joko (Gudang)</li>
                            </ul>
                        </div>
                        <div className="bg-red-50 p-2 rounded border border-red-100">
                            <p className="text-[10px] font-black uppercase text-red-700 mb-1">Terlambat (Today)</p>
                            <ul className="text-xs font-bold text-red-800 space-y-0.5">
                                <li>• Andi S. (35m)</li>
                                <li>• Budi K. (15m)</li>
                                <li>• Dedi (10m)</li>
                            </ul>
                        </div>
                    </div>

                    <Button size="sm" variant="outline" className="w-full text-xs font-black uppercase tracking-wider h-8 border-2 border-black hover:bg-purple-50">
                        Approval Cuti
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
