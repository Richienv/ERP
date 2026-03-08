"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
    IconCurrencyDollar,
    IconPlus,
    IconTrash,
    IconCalendar,
    IconArrowRight,
} from "@tabler/icons-react"
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

function formatRate(val: number | string) {
    return Number(val).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function formatIDR(val: number | string) {
    return `Rp ${Number(val).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ─── Add Currency Dialog ──────────────────────────────────────
function AddCurrencyDialog({
    open,
    onOpenChange,
}: {
    open: boolean
    onOpenChange: (o: boolean) => void
}) {
    const [code, setCode] = useState("")
    const [name, setName] = useState("")
    const [symbol, setSymbol] = useState("")
    const createCurrency = useCreateCurrency()

    const handleSubmit = async () => {
        if (!code.trim() || !name.trim() || !symbol.trim()) {
            toast.error("Semua field wajib diisi")
            return
        }
        try {
            await createCurrency.mutateAsync({ code, name, symbol })
            toast.success("Mata uang berhasil ditambahkan")
            setCode("")
            setName("")
            setSymbol("")
            onOpenChange(false)
        } catch (err: any) {
            toast.error(err.message || "Gagal menambahkan mata uang")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <IconCurrencyDollar size={20} />
                        Tambah Mata Uang
                    </DialogTitle>
                    <DialogDescription className={NB.subtitle}>
                        Daftarkan mata uang asing baru
                    </DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-4">
                    <div>
                        <label className={NB.label}>
                            Kode ISO <span className={NB.labelRequired}>*</span>
                        </label>
                        <Input
                            className={NB.input}
                            placeholder="USD"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            maxLength={3}
                        />
                    </div>
                    <div>
                        <label className={NB.label}>
                            Nama Mata Uang <span className={NB.labelRequired}>*</span>
                        </label>
                        <Input
                            className={NB.input}
                            placeholder="Dolar Amerika"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className={NB.label}>
                            Simbol <span className={NB.labelRequired}>*</span>
                        </label>
                        <Input
                            className={NB.input}
                            placeholder="$"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value)}
                            maxLength={5}
                        />
                    </div>
                    <div className={NB.footer}>
                        <Button
                            type="button"
                            className={NB.cancelBtn}
                            onClick={() => onOpenChange(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            className={NB.submitBtn}
                            onClick={handleSubmit}
                            disabled={createCurrency.isPending}
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
function AddRateDialog({
    open,
    onOpenChange,
    currency,
}: {
    open: boolean
    onOpenChange: (o: boolean) => void
    currency: Currency | null
}) {
    const today = new Date().toISOString().slice(0, 10)
    const [date, setDate] = useState(today)
    const [buyRate, setBuyRate] = useState("")
    const [sellRate, setSellRate] = useState("")
    const [middleRate, setMiddleRate] = useState("")
    const [source, setSource] = useState("Manual")
    const addRate = useAddExchangeRate()

    const autoCalcMiddle = (buy: string, sell: string) => {
        const b = Number(buy)
        const s = Number(sell)
        if (b > 0 && s > 0) {
            setMiddleRate(((b + s) / 2).toFixed(2))
        }
    }

    const handleSubmit = async () => {
        if (!currency) return
        const b = Number(buyRate)
        const s = Number(sellRate)
        const m = Number(middleRate)

        if (!date || b <= 0 || s <= 0 || m <= 0) {
            toast.error("Semua field kurs wajib diisi dengan nilai > 0")
            return
        }

        try {
            await addRate.mutateAsync({
                currencyId: currency.id,
                date,
                buyRate: b,
                sellRate: s,
                middleRate: m,
                source: source || "Manual",
            })
            toast.success(`Kurs ${currency.code} tanggal ${date} berhasil disimpan`)
            setBuyRate("")
            setSellRate("")
            setMiddleRate("")
            setSource("Manual")
            onOpenChange(false)
        } catch (err: any) {
            toast.error(err.message || "Gagal menyimpan kurs")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentNarrow}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <IconCalendar size={20} />
                        Input Kurs {currency?.code}
                    </DialogTitle>
                    <DialogDescription className={NB.subtitle}>
                        {currency?.name} ({currency?.symbol}) &mdash; masukkan kurs harian
                    </DialogDescription>
                </DialogHeader>
                <div className="p-6 space-y-4">
                    <div>
                        <label className={NB.label}>
                            Tanggal <span className={NB.labelRequired}>*</span>
                        </label>
                        <Input
                            type="date"
                            className={NB.input}
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className={NB.label}>
                                Kurs Beli <span className={NB.labelRequired}>*</span>
                            </label>
                            <Input
                                type="number"
                                className={NB.inputMono}
                                placeholder="16200"
                                value={buyRate}
                                onChange={(e) => {
                                    setBuyRate(e.target.value)
                                    autoCalcMiddle(e.target.value, sellRate)
                                }}
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className={NB.label}>
                                Kurs Jual <span className={NB.labelRequired}>*</span>
                            </label>
                            <Input
                                type="number"
                                className={NB.inputMono}
                                placeholder="16400"
                                value={sellRate}
                                onChange={(e) => {
                                    setSellRate(e.target.value)
                                    autoCalcMiddle(buyRate, e.target.value)
                                }}
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className={NB.label}>
                                Kurs Tengah <span className={NB.labelRequired}>*</span>
                            </label>
                            <Input
                                type="number"
                                className={NB.inputMono}
                                placeholder="16300"
                                value={middleRate}
                                onChange={(e) => setMiddleRate(e.target.value)}
                                step="0.01"
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-zinc-400 font-medium -mt-2">
                        Kurs tengah otomatis dihitung dari rata-rata beli &amp; jual
                    </p>
                    <div>
                        <label className={NB.label}>Sumber</label>
                        <Input
                            className={NB.input}
                            placeholder="BI / BCA / Manual"
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                        />
                    </div>
                    <div className={NB.footer}>
                        <Button
                            type="button"
                            className={NB.cancelBtn}
                            onClick={() => onOpenChange(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            className={NB.submitBtn}
                            onClick={handleSubmit}
                            disabled={addRate.isPending}
                        >
                            {addRate.isPending ? "Menyimpan..." : "Simpan Kurs"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// ─── Currency Card ────────────────────────────────────────────
function CurrencyCard({
    currency,
    onAddRate,
    onDelete,
}: {
    currency: Currency
    onAddRate: (c: Currency) => void
    onDelete: (c: Currency) => void
}) {
    const deleteRate = useDeleteExchangeRate()
    const latestRate = currency.rates[0]

    return (
        <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Header */}
            <div className="bg-black text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold">{currency.symbol}</span>
                    <div>
                        <div className="font-black text-sm tracking-wider">{currency.code}</div>
                        <div className="text-[10px] text-zinc-400 font-medium">{currency.name}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        className="bg-white text-black border-2 border-white font-black text-[10px] uppercase tracking-wider rounded-none h-7 px-3 hover:bg-zinc-200"
                        onClick={() => onAddRate(currency)}
                    >
                        <IconPlus size={14} className="mr-1" />
                        Input Kurs
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-zinc-400 hover:text-red-400 hover:bg-transparent h-7 w-7 p-0"
                        onClick={() => onDelete(currency)}
                        title="Nonaktifkan mata uang"
                    >
                        <IconTrash size={14} />
                    </Button>
                </div>
            </div>

            {/* Latest rate highlight */}
            {latestRate ? (
                <div className="px-4 py-3 border-b-2 border-zinc-200 bg-zinc-50">
                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">
                        Kurs Terbaru &mdash;{" "}
                        {format(new Date(latestRate.date), "dd MMM yyyy", { locale: localeID })}
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <div className="text-[10px] text-zinc-400 font-bold">Beli</div>
                            <div className="font-mono font-bold text-sm">{formatIDR(latestRate.buyRate)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-zinc-400 font-bold">Jual</div>
                            <div className="font-mono font-bold text-sm">{formatIDR(latestRate.sellRate)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-zinc-400 font-bold">Tengah</div>
                            <div className="font-mono font-bold text-sm text-black">{formatIDR(latestRate.middleRate)}</div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="px-4 py-3 border-b-2 border-zinc-200 bg-zinc-50 text-center">
                    <p className="text-xs text-zinc-400 font-medium">Belum ada data kurs</p>
                </div>
            )}

            {/* Rate history */}
            {currency.rates.length > 0 && (
                <ScrollArea className="max-h-[200px]">
                    <table className="w-full text-xs">
                        <thead className="bg-zinc-100 border-b border-zinc-200 sticky top-0">
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
                                <tr key={rate.id} className={`border-b border-zinc-100 ${idx === 0 ? "bg-yellow-50/50" : ""}`}>
                                    <td className="px-3 py-1.5 font-medium">
                                        {format(new Date(rate.date), "dd/MM/yyyy")}
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-mono">{formatRate(rate.buyRate)}</td>
                                    <td className="px-3 py-1.5 text-right font-mono">{formatRate(rate.sellRate)}</td>
                                    <td className="px-3 py-1.5 text-right font-mono font-bold">{formatRate(rate.middleRate)}</td>
                                    <td className="px-3 py-1.5 text-center text-zinc-400">{rate.source || "-"}</td>
                                    <td className="px-1">
                                        <button
                                            className="text-zinc-300 hover:text-red-500 transition-colors"
                                            onClick={() => {
                                                if (confirm("Hapus kurs ini?")) {
                                                    deleteRate.mutate(rate.id, {
                                                        onSuccess: () => toast.success("Kurs dihapus"),
                                                        onError: (e) => toast.error(e.message),
                                                    })
                                                }
                                            }}
                                        >
                                            <IconTrash size={13} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </ScrollArea>
            )}
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────
export default function CurrenciesPage() {
    const { data: currencies, isLoading } = useCurrencies()
    const [showAddCurrency, setShowAddCurrency] = useState(false)
    const [rateDialogCurrency, setRateDialogCurrency] = useState<Currency | null>(null)
    const deleteCurrency = useDeleteCurrency()

    if (isLoading || !currencies) {
        return <TablePageSkeleton accentColor="bg-green-400" />
    }

    return (
        <div className="mf-page">
            {/* Page Header */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white">
                <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-green-500">
                    <div className="flex items-center gap-3">
                        <IconCurrencyDollar size={24} className="text-green-600" />
                        <div>
                            <h1 className="text-lg font-black uppercase tracking-wider">
                                Tabel Kurs Mata Uang
                            </h1>
                            <p className="text-xs text-zinc-500 font-medium">
                                Kelola kurs harian untuk transaksi multi-mata uang (PO impor, invoice ekspor)
                            </p>
                        </div>
                    </div>
                    <Button
                        className={NB.triggerBtn}
                        onClick={() => setShowAddCurrency(true)}
                    >
                        <IconPlus size={16} className="mr-1" />
                        Tambah Mata Uang
                    </Button>
                </div>
            </div>

            {/* Quick Converter */}
            {currencies.length > 0 && currencies.some((c) => c.rates.length > 0) && (
                <div className="border-2 border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="bg-zinc-100 px-4 py-2 border-b-2 border-black">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                            Kurs Terkini (Kurs Tengah)
                        </span>
                    </div>
                    <div className="px-4 py-3 flex flex-wrap gap-4">
                        {currencies
                            .filter((c) => c.rates.length > 0)
                            .map((c) => (
                                <div key={c.id} className="flex items-center gap-2">
                                    <span className="font-bold text-sm">{c.symbol} 1 {c.code}</span>
                                    <IconArrowRight size={14} className="text-zinc-400" />
                                    <span className="font-mono font-bold text-sm text-green-700">
                                        {formatIDR(c.rates[0].middleRate)}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* Currency Cards Grid */}
            {currencies.length === 0 ? (
                <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-12 text-center">
                    <IconCurrencyDollar size={48} className="mx-auto text-zinc-300 mb-4" />
                    <h2 className="font-black text-lg uppercase mb-2">Belum Ada Mata Uang</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                        Tambahkan mata uang asing yang digunakan untuk transaksi impor/ekspor.
                        Contoh: USD, CNY, EUR, SGD, KRW
                    </p>
                    <Button
                        className={NB.submitBtn}
                        onClick={() => setShowAddCurrency(true)}
                    >
                        <IconPlus size={16} className="mr-1" />
                        Tambah Mata Uang Pertama
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {currencies.map((c) => (
                        <CurrencyCard
                            key={c.id}
                            currency={c}
                            onAddRate={(cur) => setRateDialogCurrency(cur)}
                            onDelete={(cur) => {
                                if (confirm(`Nonaktifkan mata uang ${cur.code}?`)) {
                                    deleteCurrency.mutate(cur.id, {
                                        onSuccess: () => toast.success(`${cur.code} dinonaktifkan`),
                                        onError: (e) => toast.error(e.message),
                                    })
                                }
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Dialogs */}
            <AddCurrencyDialog open={showAddCurrency} onOpenChange={setShowAddCurrency} />
            <AddRateDialog
                open={!!rateDialogCurrency}
                onOpenChange={(o) => !o && setRateDialogCurrency(null)}
                currency={rateDialogCurrency}
            />
        </div>
    )
}
