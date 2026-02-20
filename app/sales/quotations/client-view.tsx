"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Search,
    Plus,
    FileText,
    AlertTriangle,
    CheckCircle2,
    Send,
    TrendingUp,
    Percent,
} from "lucide-react"
import Link from "next/link"
import { QuotationKanban } from "@/components/sales/quotation-kanban"

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

interface QuotationsClientProps {
    initialQuotations: any[]
}

export default function QuotationsClient({ initialQuotations }: QuotationsClientProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus, setFilterStatus] = useState<string>("ALL")

    const filteredQuotations = useMemo(() => {
        return initialQuotations.filter(q => {
            const matchesSearch = !searchTerm.trim() ||
                q.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                q.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (q.customerRef && q.customerRef.toLowerCase().includes(searchTerm.toLowerCase()))
            const matchesStatus = filterStatus === "ALL" || q.status === filterStatus
            return matchesSearch && matchesStatus
        })
    }, [initialQuotations, searchTerm, filterStatus])

    // Stats
    const pipeValue = initialQuotations.filter(q => q.status === 'SENT').reduce((acc, q) => acc + q.total, 0)
    const winRate = initialQuotations.length > 0
        ? Math.round((initialQuotations.filter(q => q.status === 'ACCEPTED' || q.status === 'CONVERTED').length / initialQuotations.length) * 100)
        : 0
    const activeDeals = initialQuotations.filter(q => q.status === 'SENT' || q.status === 'DRAFT').length
    const stalledCount = initialQuotations.filter(q => q.status === 'EXPIRED').length

    return (
        <div className="mf-page">

            {/* ═══════════════════════════════════════════ */}
            {/* COMMAND HEADER                              */}
            {/* ═══════════════════════════════════════════ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-amber-400">
                    <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-amber-500" />
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                                Manajemen Penawaran
                            </h1>
                            <p className="text-zinc-400 text-xs font-medium mt-0.5">
                                Buat dan kelola penawaran harga kain, benang, dan jasa
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" asChild className="border-2 border-black font-black uppercase text-[10px] tracking-wider h-9 px-4 rounded-none">
                            <Link href="/sales/pricelists">
                                <FileText className="mr-2 h-3.5 w-3.5" /> Daftar Harga
                            </Link>
                        </Button>
                        <Button asChild className="bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-6 h-9 rounded-none">
                            <Link href="/sales/quotations/new">
                                <Plus className="mr-2 h-4 w-4" /> Buat Penawaran
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* KPI PULSE STRIP                            */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="grid grid-cols-2 md:grid-cols-4">
                    {/* Pipe Value */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pipe Value (Sent)</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
                            {formatCurrency(pipeValue).replace('Rp', 'Rp ')}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-amber-600">Penawaran terkirim</span>
                        </div>
                    </div>

                    {/* Win Rate */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800 border-b-2 md:border-b-0">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Percent className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Win Rate</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-emerald-600">
                            {winRate}%
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-emerald-600">Tingkat keberhasilan</span>
                        </div>
                    </div>

                    {/* Active Deals */}
                    <div className="relative p-4 md:p-5 border-r-2 border-zinc-100 dark:border-zinc-800">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <Send className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Deal Aktif</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">
                            {activeDeals}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-blue-600">Draft + Terkirim</span>
                        </div>
                    </div>

                    {/* Stalled / Expiring */}
                    <div className="relative p-4 md:p-5">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-red-400" />
                        <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Kadaluarsa</span>
                        </div>
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-red-600">
                            {stalledCount}
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold text-red-600">Perlu tindakan</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* SEARCH & FILTER BAR                        */}
            {/* ═══════════════════════════════════════════ */}
            <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3">
                    <div className="relative flex-1 max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cari nomor penawaran, pelanggan..."
                            className="pl-9 border-2 border-black font-bold h-10 placeholder:text-zinc-400 rounded-none"
                        />
                    </div>
                    {/* Status filter */}
                    <div className="flex border-2 border-black">
                        {(["ALL", "DRAFT", "SENT", "ACCEPTED", "EXPIRED"] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all border-r border-black last:border-r-0 ${
                                    filterStatus === s
                                        ? "bg-black text-white"
                                        : "bg-white text-zinc-400 hover:bg-zinc-50"
                                }`}
                            >
                                {s === "ALL" ? "Semua" : s === "DRAFT" ? "Draft" : s === "SENT" ? "Terkirim" : s === "ACCEPTED" ? "Diterima" : "Expired"}
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hidden md:block">
                        {filteredQuotations.length} penawaran
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* KANBAN BOARD                               */}
            {/* ═══════════════════════════════════════════ */}
            <QuotationKanban quotations={filteredQuotations} />

            {filteredQuotations.length === 0 && (
                <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white p-12 text-center">
                    <FileText className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tidak ada penawaran yang cocok dengan filter</p>
                </div>
            )}
        </div>
    )
}
