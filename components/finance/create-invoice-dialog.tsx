"use client"

import { useEffect, useState } from "react"
import { FileText, Receipt, CreditCard, CalendarDays } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { formatIDR } from "@/lib/utils"
import {
    getInvoiceCustomers,
    createCustomerInvoice,
    getPendingSalesOrders,
    getPendingPurchaseOrders,
    getExpenseAccounts,
} from "@/lib/actions/finance"
import {
    createInvoiceFromSalesOrder,
    createBillFromPOId,
} from "@/lib/actions/finance-invoices"
import { NB } from "@/lib/dialog-styles"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBSelect,
} from "@/components/ui/nb-dialog"

/* ─── Animation variants ─── */
const sectionFade = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
}

interface CreateInvoiceDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const parseDateInput = (value: string) => {
    if (!value) return undefined
    const parts = value.split("-").map(Number)
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return undefined
    const [year, month, day] = parts
    return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function CreateInvoiceDialog({ open, onOpenChange }: CreateInvoiceDialogProps) {
    const queryClient = useQueryClient()
    const [customers, setCustomers] = useState<Array<{ id: string; name: string; type?: string }>>([])
    const [pendingSOs, setPendingSOs] = useState<any[]>([])
    const [pendingPOs, setPendingPOs] = useState<any[]>([])
    const [dataReady, setDataReady] = useState(false)
    const [creating, setCreating] = useState(false)

    const [sourceType, setSourceType] = useState<'SO' | 'PO' | 'MANUAL'>('MANUAL')
    const [selectedOrderId, setSelectedOrderId] = useState("")
    const [selectedCustomer, setSelectedCustomer] = useState("")
    const [manualType, setManualType] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER')
    const [manualProduct, setManualProduct] = useState("")
    const [manualQty, setManualQty] = useState(1)
    const [manualPrice, setManualPrice] = useState("")
    const [includeTax, setIncludeTax] = useState(true)
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
    const [dueDate, setDueDate] = useState("")
    const [revenueAccounts, setRevenueAccounts] = useState<Array<{ id: string; code: string; name: string }>>([])
    const [selectedAccountId, setSelectedAccountId] = useState("")

    // Prefetch ALL data in parallel on dialog open
    useEffect(() => {
        if (!open) return
        let active = true
        setDataReady(false)
        const loadAll = async () => {
            try {
                const [customerList, accountsData, soData, poData] = await Promise.all([
                    getInvoiceCustomers(),
                    getExpenseAccounts(),
                    getPendingSalesOrders().catch(() => []),
                    getPendingPurchaseOrders().catch(() => []),
                ])
                if (active) {
                    setCustomers(customerList)
                    setRevenueAccounts([...(accountsData.revenueAccounts ?? []), ...(accountsData.expenseAccounts ?? [])])
                    setPendingSOs(soData)
                    setPendingPOs(poData)
                    setDataReady(true)
                }
            } catch {
                if (active) setDataReady(true)
            }
        }
        loadAll()
        return () => { active = false }
    }, [open])

    const pendingOrders = sourceType === 'SO' ? pendingSOs : pendingPOs

    const resetForm = () => {
        setSourceType('MANUAL')
        setSelectedOrderId("")
        setSelectedCustomer("")
        setManualProduct("")
        setManualQty(1)
        setManualPrice("")
        setIncludeTax(true)
        setDueDate("")
        setIssueDate(new Date().toISOString().split('T')[0])
        setSelectedAccountId("")
    }

    const handleCreate = async () => {
        if (sourceType !== 'MANUAL' && !selectedOrderId) return
        if (sourceType === 'MANUAL' && (!selectedCustomer || !manualPrice || manualQty <= 0)) return

        setCreating(true)
        try {
            let result: any
            if (sourceType === 'SO') {
                result = await createInvoiceFromSalesOrder(selectedOrderId)
            } else if (sourceType === 'PO') {
                result = await createBillFromPOId(selectedOrderId)
            } else {
                result = await createCustomerInvoice({
                    customerId: selectedCustomer,
                    amount: parseFloat(manualPrice) * manualQty,
                    issueDate: parseDateInput(issueDate),
                    dueDate: parseDateInput(dueDate),
                    includeTax,
                    items: [{
                        description: manualProduct || 'Manual Item',
                        quantity: manualQty,
                        unitPrice: parseFloat(manualPrice) || 0
                    }],
                    type: manualType,
                    ...(selectedAccountId ? { accountId: selectedAccountId } : {}),
                })
            }

            if (result.success) {
                toast.success("Dokumen berhasil dibuat")
                resetForm()
                onOpenChange(false)
                queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
            } else {
                toast.error(('error' in result ? result.error : "Gagal membuat invoice") || "Gagal membuat invoice")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setCreating(false)
        }
    }

    return (
        <NBDialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }} size="narrow">
            <NBDialogHeader icon={FileText} title="Buat Invoice" subtitle="Buat invoice/bill baru dari order atau manual" />

            <NBDialogBody>
                {/* Source Type Toggle */}
                <NBSection icon={Receipt} title="Sumber Invoice">
                    <div className="grid grid-cols-3 gap-2">
                        {([
                            { key: 'SO' as const, title: 'Sales Order', desc: 'Dari pesanan penjualan' },
                            { key: 'PO' as const, title: 'Purchase Order', desc: 'Dari pesanan pembelian' },
                            { key: 'MANUAL' as const, title: 'Manual', desc: 'Input data sendiri' },
                        ]).map((opt) => (
                            <motion.button
                                key={opt.key}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => { setSourceType(opt.key); setSelectedOrderId("") }}
                                className={`p-3 border-2 text-left transition-all ${sourceType === opt.key
                                    ? 'border-black bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                    : 'border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-500'
                                }`}
                            >
                                <span className="text-[10px] font-black uppercase tracking-wider block">{opt.title}</span>
                                <span className={`text-[9px] mt-0.5 block ${sourceType === opt.key ? 'text-zinc-300' : 'text-zinc-400'}`}>{opt.desc}</span>
                            </motion.button>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        {sourceType !== 'MANUAL' && (
                            <motion.div
                                key={sourceType}
                                variants={sectionFade}
                                initial="hidden"
                                animate="show"
                                exit="exit"
                            >
                                <label className={NB.label}>Pilih {sourceType === 'SO' ? 'Sales Order' : 'Purchase Order'} <span className={NB.labelRequired}>*</span></label>
                                <span className={NB.labelHint}>Hanya order yang belum di-invoice yang ditampilkan</span>
                                {!dataReady ? (
                                    <div className="space-y-2 mt-1">
                                        <div className="h-10 border-2 border-zinc-200 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                                        <div className="flex gap-2">
                                            <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-700 animate-pulse rounded-sm" />
                                            <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-700 animate-pulse rounded-sm" />
                                        </div>
                                    </div>
                                ) : (
                                    <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                                        <SelectTrigger className={NB.select}>
                                            <SelectValue placeholder={`Pilih ${sourceType === 'SO' ? 'Order' : 'PO'}`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {pendingOrders.length === 0 ? (
                                                <div className="p-3 text-xs text-center text-muted-foreground">
                                                    <div className="font-bold">Tidak ada {sourceType === 'SO' ? 'order' : 'PO'} pending</div>
                                                    <div className="text-[10px] mt-0.5 text-zinc-400">Semua sudah dibuatkan invoice</div>
                                                </div>
                                            ) : pendingOrders.map((order: any) => (
                                                <SelectItem key={order.id} value={order.id}>
                                                    {order.number} - {order.customerName || order.vendorName} ({formatIDR(order.amount)})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </NBSection>

                {/* Manual Invoice Form */}
                <AnimatePresence mode="wait">
                    {sourceType === 'MANUAL' && (
                        <motion.div
                            key="manual-form"
                            variants={sectionFade}
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            className="space-y-3"
                        >
                            <NBSection icon={CreditCard} title="Detail Invoice">
                                {/* Invoice Type */}
                                <div>
                                    <label className={NB.label}>Jenis Dokumen</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            { key: 'CUSTOMER' as const, label: 'Customer Invoice', desc: 'Tagihan ke pelanggan (Piutang)', color: 'blue' },
                                            { key: 'SUPPLIER' as const, label: 'Vendor Bill', desc: 'Tagihan dari supplier (Hutang)', color: 'purple' },
                                        ]).map((opt) => (
                                            <motion.button
                                                key={opt.key}
                                                whileHover={{ y: -2 }}
                                                whileTap={{ scale: 0.97 }}
                                                onClick={() => setManualType(opt.key)}
                                                className={`p-3 border-2 text-left transition-all ${manualType === opt.key
                                                    ? `border-${opt.color}-500 bg-${opt.color}-50 dark:bg-${opt.color}-950/30`
                                                    : 'border-zinc-200 dark:border-zinc-600 hover:border-zinc-400'
                                                }`}
                                            >
                                                <span className={`text-[11px] font-black uppercase tracking-wider block ${manualType === opt.key ? `text-${opt.color}-700 dark:text-${opt.color}-400` : 'text-zinc-600'}`}>{opt.label}</span>
                                                <span className="text-[9px] text-zinc-400 mt-0.5 block">{opt.desc}</span>
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>

                                {/* Customer/Vendor */}
                                <div>
                                    <label className={NB.label}>{manualType === 'CUSTOMER' ? 'Customer' : 'Vendor'} <span className={NB.labelRequired}>*</span></label>
                                    {!dataReady ? (
                                        <div className="h-10 border-2 border-zinc-200 bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
                                    ) : (
                                        <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                                            <SelectTrigger className={NB.select}>
                                                <SelectValue placeholder="Pilih pihak" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {customers.filter(c => (c as any).type === manualType).length === 0 ? (
                                                    <div className="p-3 text-xs text-center text-muted-foreground">
                                                        <div className="font-bold">Tidak ada {manualType.toLowerCase()} aktif</div>
                                                        <div className="text-[10px] mt-0.5 text-zinc-400">Tambahkan di menu Sales/Procurement</div>
                                                    </div>
                                                ) : customers.filter(c => (c as any).type === manualType).map((customer) => (
                                                    <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                {/* Product */}
                                <NBInput
                                    label="Deskripsi / Produk"
                                    value={manualProduct}
                                    onChange={setManualProduct}
                                    placeholder="e.g. Jasa Konsultasi"
                                />

                                {/* Qty + Price */}
                                <div className="grid grid-cols-2 gap-4">
                                    <NBInput
                                        label="Jumlah"
                                        required
                                        type="number"
                                        value={String(manualQty)}
                                        onChange={(v) => setManualQty(Math.max(1, Number(v) || 1))}
                                        placeholder="1"
                                    />
                                    <div>
                                        <label className={NB.label}>Harga Satuan <span className={NB.labelRequired}>*</span></label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-[10px] text-zinc-400">Rp</span>
                                            <Input className={`${NB.inputMono} pl-9`} placeholder="0" type="number" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />
                                        </div>
                                    </div>
                                </div>

                                {/* PPN Toggle */}
                                <div className="flex items-center justify-between border-2 border-zinc-200 dark:border-zinc-700 px-4 py-2.5">
                                    <div>
                                        <span className={NB.label + " !mb-0"}>PPN 11%</span>
                                        <span className={NB.labelHint}>Pajak Pertambahan Nilai</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIncludeTax(!includeTax)}
                                        className={`${NB.toggle} ${includeTax ? NB.toggleActive : NB.toggleInactive}`}
                                    >
                                        <motion.span
                                            layout
                                            transition={{ type: "spring" as const, stiffness: 500, damping: 30 }}
                                            className={`${NB.toggleThumb} ${includeTax ? 'left-5' : 'left-0.5'}`}
                                        />
                                    </button>
                                </div>

                                {/* COA Account */}
                                <NBSelect
                                    label="Akun Pendapatan / Beban (COA)"
                                    value={selectedAccountId}
                                    onValueChange={setSelectedAccountId}
                                    placeholder="Pilih akun COA"
                                    emptyLabel="Tanpa akun COA"
                                >
                                    {revenueAccounts.map((a) => (
                                        <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                                    ))}
                                </NBSelect>

                                {/* Total Preview */}
                                {(() => {
                                    const subtotal = (parseFloat(manualPrice) || 0) * manualQty
                                    const tax = includeTax ? Math.round(subtotal * 0.11) : 0
                                    const total = subtotal + tax
                                    return (
                                        <div className="border-2 border-black dark:border-white bg-zinc-900 dark:bg-zinc-100 px-4 py-3 space-y-1">
                                            <div className="flex justify-between items-center text-xs text-zinc-400 dark:text-zinc-500">
                                                <span>Subtotal</span>
                                                <span className="font-mono font-bold">{formatIDR(subtotal)}</span>
                                            </div>
                                            {includeTax && (
                                                <div className="flex justify-between items-center text-xs text-zinc-400 dark:text-zinc-500">
                                                    <span>PPN 11%</span>
                                                    <span className="font-mono font-bold">{formatIDR(tax)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center border-t border-zinc-700 dark:border-zinc-300 pt-1.5 mt-1">
                                                <span className="text-[11px] font-black uppercase tracking-wider text-white dark:text-zinc-900">Total</span>
                                                <motion.span
                                                    key={total}
                                                    initial={{ scale: 1.1 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: "spring" as const, stiffness: 300 }}
                                                    className="font-mono font-black text-xl text-white dark:text-zinc-900"
                                                >
                                                    {formatIDR(total)}
                                                </motion.span>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </NBSection>

                            {/* Dates */}
                            <NBSection icon={CalendarDays} title="Tanggal">
                                <div className="grid grid-cols-2 gap-4">
                                    <NBInput
                                        label="Tanggal Terbit"
                                        type="date"
                                        value={issueDate}
                                        onChange={setIssueDate}
                                    />
                                    <NBInput
                                        label="Jatuh Tempo"
                                        type="date"
                                        value={dueDate}
                                        onChange={setDueDate}
                                    />
                                </div>
                            </NBSection>
                        </motion.div>
                    )}
                </AnimatePresence>
            </NBDialogBody>

            <NBDialogFooter
                onCancel={() => { resetForm(); onOpenChange(false) }}
                onSubmit={handleCreate}
                submitting={creating}
                submitLabel="Buat Invoice"
                disabled={(sourceType !== 'MANUAL' && !selectedOrderId) || (sourceType === 'MANUAL' && (!selectedCustomer || !manualPrice || manualQty <= 0))}
            />
        </NBDialog>
    )
}
