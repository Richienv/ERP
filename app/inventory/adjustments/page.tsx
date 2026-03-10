"use client"

import Link from "next/link"
import { ArrowRight, ClipboardEdit, ArrowRightLeft } from "lucide-react"

export default function StockAdjustmentsPage() {
    return (
        <div className="mf-page">
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 border-l-[6px] border-l-amber-400">
                    <div className="flex items-center gap-3 mb-1">
                        <ClipboardEdit className="h-5 w-5 text-amber-500" />
                        <h1 className="text-xl font-black uppercase tracking-tight">Penyesuaian Stok</h1>
                    </div>
                    <p className="text-zinc-400 text-xs font-medium">
                        Penyesuaian stok dapat dilakukan dari beberapa halaman:
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/inventory/movements" className="block">
                    <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 bg-white hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <ArrowRightLeft className="h-6 w-6 text-violet-500 mb-3" />
                        <h3 className="font-black uppercase text-sm mb-1">Pergerakan Stok</h3>
                        <p className="text-[10px] text-zinc-500 font-medium">Buat penyesuaian dari halaman pergerakan stok dengan tombol &quot;Penyesuaian Stok&quot;.</p>
                        <div className="flex items-center gap-1 mt-3 text-[10px] font-black uppercase text-black">
                            Buka <ArrowRight className="h-3 w-3" />
                        </div>
                    </div>
                </Link>
                <Link href="/inventory/stock" className="block">
                    <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 bg-white hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <ClipboardEdit className="h-6 w-6 text-blue-500 mb-3" />
                        <h3 className="font-black uppercase text-sm mb-1">Level Stok</h3>
                        <p className="text-[10px] text-zinc-500 font-medium">Buat penyesuaian langsung dari halaman level stok.</p>
                        <div className="flex items-center gap-1 mt-3 text-[10px] font-black uppercase text-black">
                            Buka <ArrowRight className="h-3 w-3" />
                        </div>
                    </div>
                </Link>
                <Link href="/inventory/products" className="block">
                    <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-5 bg-white hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        <ClipboardEdit className="h-6 w-6 text-emerald-500 mb-3" />
                        <h3 className="font-black uppercase text-sm mb-1">Detail Produk</h3>
                        <p className="text-[10px] text-zinc-500 font-medium">Buka halaman detail produk, lalu klik &quot;Penyesuaian&quot;.</p>
                        <div className="flex items-center gap-1 mt-3 text-[10px] font-black uppercase text-black">
                            Buka <ArrowRight className="h-3 w-3" />
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    )
}
