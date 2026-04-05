"use client"

import { useState, useMemo, useRef } from "react"
import { toast } from "sonner"
import {
    Plus,
    Trash2,
    Calendar,
    ArrowRight,
    DollarSign,
    Eye,
    EyeOff,
    Search,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"
import { id as localeID } from "date-fns/locale"
import {
    useCurrencies,
    useCreateCurrency,
    useAddExchangeRate,
    useDeleteExchangeRate,
    useDeleteCurrency,
} from "@/hooks/use-currencies"
import type { Currency } from "@/hooks/use-currencies"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { NB } from "@/lib/dialog-styles"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { searchCurrencies } from "@/lib/currency-search"
import type { RankedCurrency } from "@/lib/currency-search"

/* ─── Animation variants ─── */
const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 26 } },
}

function fmtRate(val: number | string) {
    return Number(val).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}
function fmtIDR(val: number | string) {
    return `Rp ${Number(val).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ─── ISO 4217 currency list ──────────────────────────────────
const ISO_CURRENCIES: { code: string; name: string; symbol: string }[] = [
    { code: "USD", name: "Dolar Amerika Serikat", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "GBP", name: "Pound Sterling", symbol: "£" },
    { code: "JPY", name: "Yen Jepang", symbol: "¥" },
    { code: "CNY", name: "Yuan Tiongkok", symbol: "¥" },
    { code: "SGD", name: "Dolar Singapura", symbol: "S$" },
    { code: "MYR", name: "Ringgit Malaysia", symbol: "RM" },
    { code: "THB", name: "Baht Thailand", symbol: "฿" },
    { code: "AUD", name: "Dolar Australia", symbol: "A$" },
    { code: "HKD", name: "Dolar Hong Kong", symbol: "HK$" },
    { code: "KRW", name: "Won Korea Selatan", symbol: "₩" },
    { code: "TWD", name: "Dolar Taiwan", symbol: "NT$" },
    { code: "INR", name: "Rupee India", symbol: "₹" },
    { code: "PHP", name: "Peso Filipina", symbol: "₱" },
    { code: "VND", name: "Dong Vietnam", symbol: "₫" },
    { code: "SAR", name: "Riyal Arab Saudi", symbol: "ر.س" },
    { code: "AED", name: "Dirham Uni Emirat Arab", symbol: "د.إ" },
    { code: "NZD", name: "Dolar Selandia Baru", symbol: "NZ$" },
    { code: "CAD", name: "Dolar Kanada", symbol: "C$" },
    { code: "CHF", name: "Franc Swiss", symbol: "CHF" },
    { code: "SEK", name: "Krona Swedia", symbol: "kr" },
    { code: "BRL", name: "Real Brasil", symbol: "R$" },
]

// ─── Add Currency Dialog ──────────────────────────────────────
function AddCurrencyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const [search, setSearch] = useState("")
    const [selectedCode, setSelectedCode] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)
    const createCurrency = useCreateCurrency()
    const { data: existingCurrencies } = useCurrencies()

    const existingCodes = useMemo(() =>
        new Set((existingCurrencies ?? []).map(c => c.code)),
        [existingCurrencies]
    )

    const availableCurrencies = useMemo(() =>
        ISO_CURRENCIES.filter(c => !existingCodes.has(c.code)),
        [existingCodes]
    )

    // Ranked fuzzy search — only fires at 2+ chars
    const ranked: RankedCurrency[] = useMemo(() => {
        if (search.trim().length < 2) return []
        return searchCurrencies(search, availableCurrencies)
    }, [search, availableCurrencies])

    const selected = ISO_CURRENCIES.find(c => c.code === selectedCode)

    const showDropdown = search.trim().length >= 2 && !selectedCode

    const reset = () => { setSearch(""); setSelectedCode("") }

    const clearSelection = () => {
        setSearch("")
        setSelectedCode("")
        // Re-focus input after clearing
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    const handleSubmit = async () => {
        if (!selected) { toast.error("Pilih mata uang terlebih dahulu"); return }
        // Client-side duplicate guard (in case existingCodes is stale)
        if (existingCodes.has(selected.code)) {
            toast.error(`Mata uang ${selected.code} sudah terdaftar`)
            return
        }
        try {
            await createCurrency.mutateAsync({ code: selected.code, name: selected.name, symbol: selected.symbol })
            toast.success(`${selected.code} — ${selected.name} berhasil ditambahkan`)
            reset()
            onOpenChange(false)
        } catch (err: any) { toast.error(err.message || "Gagal menambahkan mata uang") }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}><DollarSign className="h-5 w-5" /> Tambah Mata Uang</DialogTitle>
                    <DialogDescription className={NB.subtitle}>Pilih mata uang asing untuk didaftarkan</DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-4">
                    {/* Search input / pill chip area */}
                    <div>
                        <label className={NB.label}>Nama Mata Uang <span className={NB.labelRequired}>*</span></label>

                        {selected ? (
                            /* ── Pill chip after selection ── */
                            <div className={`${NB.input} flex items-center h-9 px-2 border-emerald-400 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20`}>
                                <span className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-200 rounded-none select-none">
                                    <span className="font-bold text-sm">{selected.symbol}</span>
                                    <span className="font-mono font-black tracking-wider">{selected.code}</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">&mdash;</span>
                                    <span className="font-medium text-emerald-700 dark:text-emerald-300">{selected.name}</span>
                                    <button
                                        type="button"
                                        className="ml-1 text-emerald-400 dark:text-emerald-500 hover:text-red-500 dark:hover:text-red-400 transition-colors font-black text-xs leading-none"
                                        onClick={clearSelection}
                                        title="Hapus pilihan"
                                    >&#10005;</button>
                                </span>
                            </div>
                        ) : (
                            /* ── Search input ── */
                            <div className="relative">
                                <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none ${search ? NB.inputIconActive : NB.inputIconEmpty}`} />
                                <Input
                                    ref={inputRef}
                                    className={`${NB.input} pl-8 ${search.trim().length >= 2 ? NB.inputActive : NB.inputEmpty}`}
                                    placeholder="Ketik nama mata uang... (Euro, Yen, Dolar)"
                                    value={search}
                                    onChange={(e) => { setSearch(e.target.value); setSelectedCode("") }}
                                    autoFocus
                                />
                                {search && (
                                    <button
                                        type="button"
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs font-bold transition-colors"
                                        onClick={() => setSearch("")}
                                    >&#10005;</button>
                                )}
                            </div>
                        )}

                        {/* Hint text */}
                        {!selected && search.trim().length < 2 && (
                            <p className="text-[9px] mt-0.5 font-bold text-zinc-400">
                                Ketik minimal 2 huruf untuk mencari
                            </p>
                        )}
                    </div>

                    {/* Dropdown results — only when 2+ chars typed & not yet selected */}
                    {showDropdown && (
                        <div className="border-2 border-zinc-200 dark:border-zinc-700 -mt-2 overflow-hidden">
                            <ScrollArea className="max-h-[180px]">
                                {ranked.length === 0 ? (
                                    <div className="px-4 py-4 text-center">
                                        <p className="text-xs text-zinc-400 font-medium">
                                            Mata uang tidak ditemukan untuk &apos;{search.trim()}&apos;
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {ranked.map(c => (
                                            <button
                                                key={c.code}
                                                type="button"
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
                                                onClick={() => { setSelectedCode(c.code); setSearch("") }}
                                            >
                                                <span className="w-7 text-center text-base font-bold text-zinc-500 dark:text-zinc-400 shrink-0">{c.symbol}</span>
                                                <span className="font-mono font-black text-xs tracking-wider text-zinc-700 dark:text-zinc-200">{c.code}</span>
                                                <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate flex-1">{c.name}</span>
                                                {c.matchTier === 4 && (
                                                    <span className="text-[9px] font-mono font-medium text-amber-500 dark:text-amber-400 shrink-0 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5">
                                                        &asymp; &quot;{search.trim().toLowerCase()}&quot;
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    )}

                    {/* Auto-filled preview — shown after selection */}
                    {selected && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={NB.label}>Kode ISO</label>
                                <div className={`${NB.inputMono} flex items-center h-9 px-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700`}>
                                    {selected.code}
                                </div>
                            </div>
                            <div>
                                <label className={NB.label}>Simbol</label>
                                <div className={`${NB.input} flex items-center h-9 px-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700`}>
                                    {selected.symbol}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={NB.footer}>
                        <Button type="button" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>Batal</Button>
                        <Button
                            className={NB.submitBtn}
                            onClick={handleSubmit}
                            disabled={createCurrency.isPending || !selectedCode}
                        >
                            {createCurrency.isPending ? "Menyimpan..." : "Simpan"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─── Add Rate Dialog ──────────────────────────────────────────
function AddRateDialog({ open, onOpenChange, currency }: { open: boolean; onOpenChange: (o: boolean) => void; currency: Currency | null }) {
    const today = new Date().toISOString().slice(0, 10)
    const [date, setDate] = useState(today)
    const [buyRate, setBuyRate] = useState("")
    const [sellRate, setSellRate] = useState("")
    const [middleRate, setMiddleRate] = useState("")
    const [source, setSource] = useState("Manual")
    const addRate = useAddExchangeRate()

    const autoCalcMiddle = (buy: string, sell: string) => {
        const b = Number(buy), s = Number(sell)
        if (b > 0 && s > 0) setMiddleRate(((b + s) / 2).toFixed(2))
    }

    const handleSubmit = async () => {
        if (!currency) return
        const b = Number(buyRate), s = Number(sellRate), m = Number(middleRate)
        if (!date || b <= 0 || s <= 0 || m <= 0) { toast.error("Semua field kurs wajib diisi dengan nilai > 0"); return }
        try {
            await addRate.mutateAsync({ currencyId: currency.id, date, buyRate: b, sellRate: s, middleRate: m, source: source || "Manual" })
            toast.success(`Kurs ${currency.code} tanggal ${date} berhasil disimpan`)
            setBuyRate(""); setSellRate(""); setMiddleRate(""); setSource("Manual")
            onOpenChange(false)
        } catch (err: any) { toast.error(err.message || "Gagal menyimpan kurs") }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}><Calendar className="h-5 w-5" /> Input Kurs {currency?.code}</DialogTitle>
                    <DialogDescription className={NB.subtitle}>{currency?.name} ({currency?.symbol}) &mdash; masukkan kurs harian</DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-4">
                    <div>
                        <label className={NB.label}>Tanggal <span className={NB.labelRequired}>*</span></label>
                        <Input type="date" className={NB.input} value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div><label className={NB.label}>Kurs Beli <span className={NB.labelRequired}>*</span></label><Input type="number" className={NB.inputMono} placeholder="16200" value={buyRate} onChange={(e) => { setBuyRate(e.target.value); autoCalcMiddle(e.target.value, sellRate) }} step="0.01" /></div>
                        <div><label className={NB.label}>Kurs Jual <span className={NB.labelRequired}>*</span></label><Input type="number" className={NB.inputMono} placeholder="16400" value={sellRate} onChange={(e) => { setSellRate(e.target.value); autoCalcMiddle(buyRate, e.target.value) }} step="0.01" /></div>
                        <div><label className={NB.label}>Kurs Tengah <span className={NB.labelRequired}>*</span></label><Input type="number" className={NB.inputMono} placeholder="16300" value={middleRate} onChange={(e) => setMiddleRate(e.target.value)} step="0.01" /></div>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-medium -mt-2">Kurs tengah otomatis dihitung dari rata-rata beli &amp; jual</p>
                    <div>
                        <label className={NB.label}>Sumber</label>
                        <Input className={NB.input} placeholder="BI / BCA / Manual" value={source} onChange={(e) => setSource(e.target.value)} />
                    </div>
                    <div className={NB.footer}>
                        <Button type="button" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>Batal</Button>
                        <Button className={NB.submitBtn} onClick={handleSubmit} disabled={addRate.isPending}>{addRate.isPending ? "Menyimpan..." : "Simpan Kurs"}</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─── Currency Card (redesigned) ──────────────────────────────
function CurrencyCard({ currency, onAddRate, onDelete }: { currency: Currency; onAddRate: (c: Currency) => void; onDelete: (c: Currency) => void }) {
    const deleteRate = useDeleteExchangeRate()
    const latestRate = currency.rates[0]

    return (
        <motion.div
            variants={fadeUp}
            className="border-2 border-black bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
        >
            {/* Card header — black bar */}
            <div className="bg-black dark:bg-zinc-950 text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold">{currency.symbol}</span>
                    <div>
                        <div className="font-black text-sm tracking-wider">{currency.code}</div>
                        <div className="text-[10px] text-zinc-400 font-medium">{currency.name}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="flex items-center gap-1 bg-white text-black font-black text-[10px] uppercase tracking-wider rounded-none h-7 px-3 hover:bg-zinc-200 transition-colors"
                        onClick={() => onAddRate(currency)}
                    >
                        <Plus className="h-3 w-3" /> Input Kurs
                    </button>
                    <button
                        className="text-zinc-400 hover:text-red-400 transition-colors h-7 w-7 flex items-center justify-center"
                        onClick={() => onDelete(currency)}
                        title="Hapus mata uang"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Latest rate highlight */}
            {latestRate ? (
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/30">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">
                        Kurs Terbaru &mdash; {format(new Date(latestRate.date), "dd MMM yyyy", { locale: localeID })}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <div className="text-[10px] text-zinc-400 font-bold uppercase">Beli</div>
                            <div className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">{fmtIDR(latestRate.buyRate)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-zinc-400 font-bold uppercase">Jual</div>
                            <div className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">{fmtIDR(latestRate.sellRate)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-zinc-400 font-bold uppercase">Tengah</div>
                            <div className="font-mono font-black text-sm text-orange-600 dark:text-orange-400">{fmtIDR(latestRate.middleRate)}</div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/30 text-center">
                    <p className="text-xs text-zinc-400 font-medium">Belum ada data kurs</p>
                </div>
            )}

            {/* Rate history table */}
            {currency.rates.length > 0 && (
                <ScrollArea className="max-h-[200px]">
                    <table className="w-full text-xs">
                        <thead className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 sticky top-0">
                            <tr>
                                <th className="text-left px-3 py-1.5 font-black uppercase tracking-widest text-[10px] text-zinc-500">Tanggal</th>
                                <th className="text-right px-3 py-1.5 font-black uppercase tracking-widest text-[10px] text-zinc-500">Beli</th>
                                <th className="text-right px-3 py-1.5 font-black uppercase tracking-widest text-[10px] text-zinc-500">Jual</th>
                                <th className="text-right px-3 py-1.5 font-black uppercase tracking-widest text-[10px] text-zinc-500">Tengah</th>
                                <th className="text-center px-3 py-1.5 font-black uppercase tracking-widest text-[10px] text-zinc-500">Sumber</th>
                                <th className="w-8"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {currency.rates.map((rate, idx) => (
                                <tr key={rate.id} className={`border-b border-zinc-100 dark:border-zinc-800 hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-colors ${idx === 0 ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
                                    <td className="px-3 py-1.5 font-medium text-zinc-700 dark:text-zinc-300">{format(new Date(rate.date), "dd/MM/yyyy")}</td>
                                    <td className="px-3 py-1.5 text-right font-mono text-zinc-700 dark:text-zinc-300">{fmtRate(rate.buyRate)}</td>
                                    <td className="px-3 py-1.5 text-right font-mono text-zinc-700 dark:text-zinc-300">{fmtRate(rate.sellRate)}</td>
                                    <td className="px-3 py-1.5 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">{fmtRate(rate.middleRate)}</td>
                                    <td className="px-3 py-1.5 text-center text-zinc-400">{rate.source || "-"}</td>
                                    <td className="px-1">
                                        <button
                                            className="text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                            onClick={() => {
                                                if (confirm("Hapus kurs ini?")) {
                                                    deleteRate.mutate(rate.id, {
                                                        onSuccess: () => toast.success("Kurs dihapus"),
                                                        onError: (e) => toast.error(e.message),
                                                    })
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </ScrollArea>
            )}
        </motion.div>
    )
}

// ─── Main Page ────────────────────────────────────────────────
export default function CurrenciesPage() {
    const { data: currencies, isLoading } = useCurrencies()
    const [showAddCurrency, setShowAddCurrency] = useState(false)
    const [rateDialogCurrency, setRateDialogCurrency] = useState<Currency | null>(null)
    const [showRates, setShowRates] = useState(true)
    const deleteCurrency = useDeleteCurrency()

    if (isLoading || !currencies) return <TablePageSkeleton accentColor="bg-orange-400" />

    const currenciesWithRates = currencies.filter((c) => c.rates.length > 0)
    const totalCurrencies = currencies.length
    const totalRates = currencies.reduce((s, c) => s + c.rates.length, 0)

    return (
        <motion.div className="mf-page" variants={stagger} initial="hidden" animate="show">
            {/* ─── Unified Page Header ─── */}
            <motion.div variants={fadeUp} className={NB.pageCard}>
                <div className={NB.pageAccent} />

                {/* Row 1: Title + Actions */}
                <div className={`px-5 py-3.5 flex items-center justify-between ${NB.pageRowBorder}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
                            <DollarSign className="h-4.5 w-4.5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                                Tabel Kurs Mata Uang
                            </h1>
                            <p className="text-zinc-400 text-[11px] font-medium">
                                Kelola kurs harian untuk transaksi multi-mata uang (PO impor, invoice ekspor)
                            </p>
                        </div>
                    </div>
                    <Button onClick={() => setShowAddCurrency(true)} className={NB.toolbarBtnPrimary}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Mata Uang
                    </Button>
                </div>

                {/* Row 2: KPI Strip */}
                <div className={`flex items-center divide-x divide-zinc-200 dark:divide-zinc-800 ${NB.pageRowBorder}`}>
                    <div className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-orange-500" />
                            <span className={NB.kpiLabel}>Mata Uang</span>
                        </div>
                        <motion.span key={totalCurrencies} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={NB.kpiCount}>{totalCurrencies}</motion.span>
                    </div>
                    <div className="flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-blue-500" />
                            <span className={NB.kpiLabel}>Data Kurs</span>
                        </div>
                        <motion.span key={totalRates} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={NB.kpiCount}>{totalRates}</motion.span>
                    </div>
                    {/* Quick converter strip */}
                    {currenciesWithRates.map((c) => (
                        <div key={c.id} className="flex-1 px-4 py-3 flex items-center justify-between gap-2 cursor-default">
                            <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-zinc-700 dark:text-zinc-300">{c.symbol} 1 {c.code}</span>
                                <ArrowRight className="h-3 w-3 text-zinc-400" />
                            </div>
                            <AnimatePresence>
                                {showRates && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -8 }}
                                        className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400"
                                    >
                                        {fmtIDR(c.rates[0].middleRate)}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            <button
                                onClick={() => setShowRates(!showRates)}
                                className="p-0.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                            >
                                {showRates ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            </button>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* ─── Currency Cards Grid ─── */}
            {currencies.length === 0 ? (
                <motion.div
                    variants={fadeUp}
                    className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 p-12 text-center"
                >
                    <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mx-auto mb-4">
                        <DollarSign className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                    </div>
                    <h2 className="font-black text-lg uppercase mb-2 text-zinc-900 dark:text-white">Belum Ada Mata Uang</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                        Tambahkan mata uang asing yang digunakan untuk transaksi impor/ekspor.
                        Contoh: USD, CNY, EUR, SGD, KRW
                    </p>
                    <Button className={NB.submitBtnOrange} onClick={() => setShowAddCurrency(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Tambah Mata Uang Pertama
                    </Button>
                </motion.div>
            ) : (
                <motion.div variants={stagger} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {currencies.map((c) => (
                        <CurrencyCard
                            key={c.id}
                            currency={c}
                            onAddRate={(cur) => setRateDialogCurrency(cur)}
                            onDelete={(cur) => {
                                if (confirm(`Hapus mata uang ${cur.code}? Semua data kurs untuk mata uang ini juga akan dihapus.`)) {
                                    deleteCurrency.mutate(cur.id, {
                                        onSuccess: () => toast.success(`${cur.code} berhasil dihapus`),
                                        onError: (e) => toast.error(e.message),
                                    })
                                }
                            }}
                        />
                    ))}
                </motion.div>
            )}

            {/* Dialogs */}
            <AddCurrencyDialog open={showAddCurrency} onOpenChange={setShowAddCurrency} />
            <AddRateDialog open={!!rateDialogCurrency} onOpenChange={(o) => !o && setRateDialogCurrency(null)} currency={rateDialogCurrency} />
        </motion.div>
    )
}
