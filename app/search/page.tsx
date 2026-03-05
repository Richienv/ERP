"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Package, Users, FileText, Wrench, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type SearchResult = {
    id: string
    title: string
    subtitle?: string
    module: string
    url: string
}

type GroupedResults = Record<string, SearchResult[]>

const MODULE_CONFIG: Record<string, { label: string; icon: typeof Package; color: string }> = {
    produk: { label: "Produk", icon: Package, color: "bg-blue-50 border-blue-200 text-blue-700" },
    pelanggan: { label: "Pelanggan", icon: Users, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    invoice: { label: "Invoice", icon: FileText, color: "bg-amber-50 border-amber-200 text-amber-700" },
    "work-order": { label: "Work Order", icon: Wrench, color: "bg-violet-50 border-violet-200 text-violet-700" },
}

export default function SearchPage() {
    const router = useRouter()
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<GroupedResults>({})
    const [searching, setSearching] = useState(false)
    const [searched, setSearched] = useState(false)

    const handleSearch = useCallback(async () => {
        const q = query.trim()
        if (!q) return

        setSearching(true)
        setSearched(false)

        try {
            const grouped: GroupedResults = {}

            // Search products
            try {
                const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=5`)
                const json = await res.json()
                const products = (json.products || json.data || []).slice(0, 5)
                if (products.length > 0) {
                    grouped.produk = products.map((p: any) => ({
                        id: p.id,
                        title: p.name || p.nama || p.code || "—",
                        subtitle: p.sku || p.code || p.category?.name || "",
                        module: "produk",
                        url: `/inventory/products/${p.id}`,
                    }))
                }
            } catch { /* skip */ }

            // Search customers
            try {
                const res = await fetch(`/api/sales/customers?search=${encodeURIComponent(q)}&limit=5`)
                const json = await res.json()
                const customers = (json.customers || json.data || []).slice(0, 5)
                if (customers.length > 0) {
                    grouped.pelanggan = customers.map((c: any) => ({
                        id: c.id,
                        title: c.name || c.companyName || "—",
                        subtitle: c.email || c.phone || c.type || "",
                        module: "pelanggan",
                        url: `/sales/customers/${c.id}`,
                    }))
                }
            } catch { /* skip */ }

            setResults(grouped)
        } catch {
            setResults({})
        } finally {
            setSearching(false)
            setSearched(true)
        }
    }, [query])

    const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0)

    return (
        <div className="mf-page">
            {/* Header */}
            <div>
                <h1 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                    <Search className="h-6 w-6" /> Pencarian
                </h1>
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                    Cari produk, pelanggan, invoice, dan data lainnya
                </p>
            </div>

            {/* Search Bar */}
            <div className="flex gap-3 items-center">
                <div className="flex-1 max-w-lg">
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Ketik nama produk, pelanggan, nomor invoice..."
                        className="border-2 border-black rounded-none h-11 font-bold text-sm"
                        autoFocus
                    />
                </div>
                <Button
                    onClick={handleSearch}
                    disabled={searching || !query.trim()}
                    className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all uppercase font-black tracking-widest text-xs rounded-none px-6 h-11"
                >
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                    {searching ? "Mencari..." : "Cari"}
                </Button>
            </div>

            {/* Results */}
            {searching && (
                <div className="flex items-center justify-center py-16 text-zinc-400">
                    <Loader2 className="h-6 w-6 animate-spin mr-3" />
                    <span className="text-sm font-bold">Mencari...</span>
                </div>
            )}

            {searched && !searching && totalResults === 0 && (
                <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8 text-center">
                    <Search className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
                    <p className="text-sm font-bold text-zinc-500">
                        Tidak ditemukan hasil untuk &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                        Coba kata kunci yang berbeda
                    </p>
                </div>
            )}

            {!searching && totalResults > 0 && (
                <div className="space-y-6">
                    <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                        {totalResults} hasil ditemukan
                    </p>

                    {Object.entries(results).map(([module, items]) => {
                        const config = MODULE_CONFIG[module]
                        if (!config || items.length === 0) return null
                        const Icon = config.icon

                        return (
                            <div key={module} className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 border-2 border-black ${config.color}`}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-widest">
                                        {config.label} ({items.length})
                                    </span>
                                </div>

                                <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] divide-y-2 divide-black">
                                    {items.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => router.push(item.url)}
                                            className="w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors flex items-center justify-between group"
                                        >
                                            <div>
                                                <p className="text-sm font-bold group-hover:underline">
                                                    {item.title}
                                                </p>
                                                {item.subtitle && (
                                                    <p className="text-[11px] text-zinc-400 font-mono">
                                                        {item.subtitle}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300 group-hover:text-black transition-colors">
                                                Buka &rarr;
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Empty State (before search) */}
            {!searched && !searching && (
                <div className="border-2 border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
                    <Search className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
                    <p className="text-sm font-bold text-zinc-400">
                        Mulai ketik untuk mencari data di seluruh modul
                    </p>
                    <p className="text-[11px] text-zinc-300 mt-1">
                        Produk, pelanggan, invoice, work order
                    </p>
                </div>
            )}
        </div>
    )
}
