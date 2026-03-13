"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { PlusCircle, Receipt, BookOpenText, FileSpreadsheet, FileBarChart, Loader2, Landmark, CreditCard, PiggyBank, Wallet, ArrowRight } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { NB } from "@/lib/dialog-styles"
import { createGLAccount, getGLAccountsList, getVendorBills, postJournalEntry, recordVendorPayment, type VendorBill } from "@/lib/actions/finance"
import { getVendors } from "@/lib/actions/procurement"

interface VendorOption {
  id: string
  name: string
}

export function AccountingModuleActions() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [vendors, setVendors] = useState<VendorOption[]>([])
  const [bills, setBills] = useState<VendorBill[]>([])
  const [glAccounts, setGlAccounts] = useState<Array<{ id: string; code: string; name: string; type: string }>>([])
  const [loadingMaster, setLoadingMaster] = useState(true)

  const [apOpen, setApOpen] = useState(false)
  const [coaOpen, setCoaOpen] = useState(false)
  const [journalOpen, setJournalOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const [apSubmitting, setApSubmitting] = useState(false)
  const [coaSubmitting, setCoaSubmitting] = useState(false)
  const [journalSubmitting, setJournalSubmitting] = useState(false)

  const [apSupplierId, setApSupplierId] = useState("")
  const [apBillId, setApBillId] = useState("")
  const [apAmount, setApAmount] = useState("")
  const [apMethod, setApMethod] = useState<"CASH" | "TRANSFER" | "CHECK">("TRANSFER")
  const [apReference, setApReference] = useState("")

  const [coaCode, setCoaCode] = useState("")
  const [coaName, setCoaName] = useState("")
  const [coaType, setCoaType] = useState<"ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE">("ASSET")

  const [journalDescription, setJournalDescription] = useState("")
  const [journalReference, setJournalReference] = useState("")
  const [journalDebitAccount, setJournalDebitAccount] = useState("")
  const [journalCreditAccount, setJournalCreditAccount] = useState("")
  const [journalAmount, setJournalAmount] = useState("")

  const [reportType, setReportType] = useState<"pnl" | "bs" | "cf">("pnl")
  const [reportStart, setReportStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10))
  const [reportEnd, setReportEnd] = useState(new Date().toISOString().slice(0, 10))

  useEffect(() => {
    const loadMaster = async () => {
      setLoadingMaster(true)
      try {
        const [vendorData, billData, accountData] = await Promise.all([
          getVendors(),
          getVendorBills(),
          getGLAccountsList(),
        ])

        setVendors((vendorData || []).map((v: any) => ({ id: v.id, name: v.name })))
        setBills(billData || [])
        setGlAccounts(accountData || [])
      } catch {
        toast.error("Gagal memuat data master finance")
      } finally {
        setLoadingMaster(false)
      }
    }

    loadMaster()
  }, [])

  const filteredBills = useMemo(() => {
    if (!apSupplierId) return bills
    return bills.filter((bill) => bill.vendor?.id === apSupplierId)
  }, [apSupplierId, bills])

  async function handleCreateAPPayment() {
    const amount = Number(apAmount)
    if (!apSupplierId || !amount || amount <= 0) {
      toast.error("Lengkapi vendor dan jumlah pembayaran")
      return
    }

    setApSubmitting(true)
    try {
      const result = await recordVendorPayment({
        supplierId: apSupplierId,
        billId: apBillId && apBillId !== "none" ? apBillId : undefined,
        amount,
        method: apMethod,
        reference: apReference || undefined,
      })

      if (!result.success) {
        toast.error(("error" in result ? result.error : null) || "Gagal membuat pembayaran AP")
        return
      }

      toast.success(`Pembayaran AP tersimpan (${("paymentNumber" in result ? result.paymentNumber : null) || "OK"})`)
      setApSupplierId("")
      setApBillId("")
      setApAmount("")
      setApMethod("TRANSFER")
      setApReference("")
      setApOpen(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.bills.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
    } finally {
      setApSubmitting(false)
    }
  }

  async function handleCreateAccount() {
    if (!coaCode || !coaName) {
      toast.error("Kode akun dan nama akun wajib diisi")
      return
    }

    setCoaSubmitting(true)
    try {
      const result = await createGLAccount({
        code: coaCode.trim(),
        name: coaName.trim(),
        type: coaType,
      })

      if (!result.success) {
        toast.error(("error" in result ? result.error : null) || "Gagal membuat akun COA")
        return
      }

      toast.success("Akun COA berhasil dibuat")
      setCoaCode("")
      setCoaName("")
      setCoaType("ASSET")
      setCoaOpen(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.glAccounts.all })
    } finally {
      setCoaSubmitting(false)
    }
  }

  async function handleCreateJournal() {
    const amount = Number(journalAmount)
    if (!journalDescription || !journalDebitAccount || !journalCreditAccount || !amount || amount <= 0) {
      toast.error("Lengkapi deskripsi, akun debit/kredit, dan nominal jurnal")
      return
    }

    if (journalDebitAccount === journalCreditAccount) {
      toast.error("Akun debit dan kredit harus berbeda")
      return
    }

    const debit = glAccounts.find((a) => a.id === journalDebitAccount)
    const credit = glAccounts.find((a) => a.id === journalCreditAccount)
    if (!debit || !credit) {
      toast.error("Akun jurnal tidak valid")
      return
    }

    setJournalSubmitting(true)
    try {
      const result = await postJournalEntry({
        date: new Date(),
        description: journalDescription,
        reference: journalReference || "",
        lines: [
          { accountCode: debit.code, debit: amount, credit: 0, description: journalDescription },
          { accountCode: credit.code, debit: 0, credit: amount, description: journalDescription },
        ],
      })

      if (!result.success) {
        toast.error(("error" in result ? result.error : null) || "Gagal memposting jurnal")
        return
      }

      toast.success("Jurnal umum berhasil diposting")
      setJournalDescription("")
      setJournalReference("")
      setJournalDebitAccount("")
      setJournalCreditAccount("")
      setJournalAmount("")
      setJournalOpen(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.financeDashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.chartAccounts.all })
    } finally {
      setJournalSubmitting(false)
    }
  }

  function handleOpenReport() {
    const params = new URLSearchParams({
      type: reportType,
      startDate: reportStart,
      endDate: reportEnd,
    })

    setReportOpen(false)
    router.push(`/finance/reports?${params.toString()}`)
  }

  return (
    <Card className="border border-border/50 rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">Finance Module Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Shortcut form untuk roadmap Finance: AP, COA, Jurnal, dan Laporan.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Dialog open={apOpen} onOpenChange={setApOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="justify-start h-11">
                <Receipt className="mr-2 h-4 w-4" /> Pembayaran (AP)
              </Button>
            </DialogTrigger>
            <DialogContent className={NB.contentNarrow}>
              <DialogHeader className={NB.header}>
                <DialogTitle className={NB.title}>
                  <Receipt className="h-5 w-5" /> Buat Pembayaran AP
                </DialogTitle>
                <p className={NB.subtitle}>Catat pembayaran vendor dan link ke tagihan</p>
              </DialogHeader>
              <div className="p-6 space-y-5">
                <div>
                  <label className={NB.label}>Vendor <span className={NB.labelRequired}>*</span></label>
                  <Select value={apSupplierId} onValueChange={setApSupplierId} disabled={loadingMaster}>
                    <SelectTrigger className={NB.select}><SelectValue placeholder="Pilih vendor..." /></SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={NB.label}>Tagihan (Opsional)</label>
                  <Select value={apBillId} onValueChange={setApBillId}>
                    <SelectTrigger className={NB.select}><SelectValue placeholder="Pilih tagihan..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak ditautkan</SelectItem>
                      {filteredBills.map((bill) => (
                        <SelectItem key={bill.id} value={bill.id}>
                          {bill.number} - {bill.vendor?.name || "Unknown"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={NB.label}>Jumlah <span className={NB.labelRequired}>*</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400">Rp</span>
                      <Input type="number" min="0" value={apAmount} onChange={(e) => setApAmount(e.target.value)} placeholder="0" className={NB.inputMono + " pl-9"} />
                    </div>
                  </div>
                  <div>
                    <label className={NB.label}>Metode <span className={NB.labelRequired}>*</span></label>
                    <Select value={apMethod} onValueChange={(value) => setApMethod(value as "CASH" | "TRANSFER" | "CHECK")}>
                      <SelectTrigger className={NB.select}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRANSFER">Transfer</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="CHECK">Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className={NB.label}>Referensi</label>
                  <Input value={apReference} onChange={(e) => setApReference(e.target.value)} placeholder="No. referensi..." className={NB.input} />
                </div>
                <div className={NB.footer}>
                  <Button variant="outline" className={NB.cancelBtn} onClick={() => setApOpen(false)}>Batal</Button>
                  <Button onClick={handleCreateAPPayment} disabled={apSubmitting} className={NB.submitBtn}>
                    {apSubmitting ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Menyimpan...</>
                    ) : (
                      <><PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Simpan Pembayaran</>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={coaOpen} onOpenChange={setCoaOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="justify-start h-11">
                <BookOpenText className="mr-2 h-4 w-4" /> Chart of Accounts
              </Button>
            </DialogTrigger>
            <DialogContent className={NB.contentNarrow}>
              <DialogHeader className={NB.header}>
                <DialogTitle className={NB.title}>
                  <BookOpenText className="h-5 w-5" /> Tambah Akun COA
                </DialogTitle>
                <p className={NB.subtitle}>Buat akun baru langsung masuk ke chart of accounts</p>
              </DialogHeader>
              <div className="p-6 space-y-5">
                {/* Account Type Selector — visual tile picker */}
                <div>
                  <label className={NB.label}>Tipe Akun <span className={NB.labelRequired}>*</span></label>
                  <div className="grid grid-cols-5 gap-1.5 mt-1">
                    {([
                      { value: "ASSET" as const, label: "Asset", icon: Landmark, activeBg: "bg-emerald-50", activeIcon: "text-emerald-600" },
                      { value: "LIABILITY" as const, label: "Liability", icon: CreditCard, activeBg: "bg-red-50", activeIcon: "text-red-600" },
                      { value: "EQUITY" as const, label: "Equity", icon: PiggyBank, activeBg: "bg-blue-50", activeIcon: "text-blue-600" },
                      { value: "REVENUE" as const, label: "Revenue", icon: Wallet, activeBg: "bg-purple-50", activeIcon: "text-purple-600" },
                      { value: "EXPENSE" as const, label: "Expense", icon: Receipt, activeBg: "bg-orange-50", activeIcon: "text-orange-600" },
                    ]).map(({ value, label, icon: Icon, activeBg, activeIcon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCoaType(value)}
                        className={`flex flex-col items-center gap-1.5 p-2.5 border-2 transition-all ${
                          coaType === value
                            ? `border-black ${activeBg} shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]`
                            : "border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50"
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${coaType === value ? activeIcon : "text-zinc-400"}`} />
                        <span className={`text-[8px] font-black uppercase tracking-widest ${coaType === value ? "text-black" : "text-zinc-400"}`}>
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code + Name fields — 1/3 + 2/3 grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={NB.label}>Kode <span className={NB.labelRequired}>*</span></label>
                    <Input value={coaCode} onChange={(e) => setCoaCode(e.target.value)} placeholder="6100" className={NB.inputMono} />
                  </div>
                  <div className="col-span-2">
                    <label className={NB.label}>Nama Akun <span className={NB.labelRequired}>*</span></label>
                    <Input value={coaName} onChange={(e) => setCoaName(e.target.value)} placeholder="Biaya Listrik" className={NB.input} />
                  </div>
                </div>

                {/* Preview strip */}
                {(coaCode.trim() || coaName.trim()) && (
                  <div className="border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-2.5 flex items-center gap-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Preview</span>
                    <span className="font-mono font-bold text-sm text-zinc-900">{coaCode || "—"}</span>
                    <span className="text-sm font-bold text-zinc-700">{coaName || "—"}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 border border-zinc-300 text-zinc-500 ml-auto">{coaType}</span>
                  </div>
                )}

                <div className={NB.footer}>
                  <Button variant="outline" className={NB.cancelBtn} onClick={() => setCoaOpen(false)}>Batal</Button>
                  <Button onClick={handleCreateAccount} disabled={coaSubmitting || !coaCode.trim() || !coaName.trim()} className={NB.submitBtn}>
                    {coaSubmitting ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Menyimpan...</>
                    ) : (
                      <><PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Simpan Akun</>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={journalOpen} onOpenChange={setJournalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="justify-start h-11">
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Jurnal Umum
              </Button>
            </DialogTrigger>
            <DialogContent className={NB.contentNarrow}>
              <DialogHeader className={NB.header}>
                <DialogTitle className={NB.title}>
                  <FileSpreadsheet className="h-5 w-5" /> Posting Jurnal Umum
                </DialogTitle>
                <p className={NB.subtitle}>Entri cepat jurnal — debit & kredit seimbang</p>
              </DialogHeader>
              <div className="p-6 space-y-5">
                {/* Header section */}
                <div className={NB.section}>
                  <div className={NB.sectionHead}>
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span className={NB.sectionTitle}>Header Jurnal</span>
                  </div>
                  <div className={NB.sectionBody}>
                    <div>
                      <label className={NB.label}>Deskripsi <span className={NB.labelRequired}>*</span></label>
                      <Input value={journalDescription} onChange={(e) => setJournalDescription(e.target.value)} placeholder="Beban listrik..." className={NB.input} />
                    </div>
                    <div>
                      <label className={NB.label}>Referensi</label>
                      <Input value={journalReference} onChange={(e) => setJournalReference(e.target.value)} placeholder="Opsional" className={NB.input} />
                    </div>
                  </div>
                </div>

                {/* Journal lines section */}
                <div className={NB.section}>
                  <div className={NB.sectionHead}>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span className={NB.sectionTitle}>Baris Jurnal</span>
                  </div>
                  <div className={NB.sectionBody}>
                    <div>
                      <label className={NB.label}>Akun Debit <span className={NB.labelRequired}>*</span></label>
                      <Select value={journalDebitAccount} onValueChange={setJournalDebitAccount}>
                        <SelectTrigger className={NB.select}><SelectValue placeholder="Pilih akun debit..." /></SelectTrigger>
                        <SelectContent>
                          {glAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={NB.label}>Akun Kredit <span className={NB.labelRequired}>*</span></label>
                      <Select value={journalCreditAccount} onValueChange={setJournalCreditAccount}>
                        <SelectTrigger className={NB.select}><SelectValue placeholder="Pilih akun kredit..." /></SelectTrigger>
                        <SelectContent>
                          {glAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={NB.label}>Nominal <span className={NB.labelRequired}>*</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400">Rp</span>
                        <Input type="number" min="0" value={journalAmount} onChange={(e) => setJournalAmount(e.target.value)} placeholder="0" className={NB.inputMono + " pl-9"} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={NB.footer}>
                  <Button variant="outline" className={NB.cancelBtn} onClick={() => setJournalOpen(false)}>Batal</Button>
                  <Button onClick={handleCreateJournal} disabled={journalSubmitting} className={NB.submitBtn}>
                    {journalSubmitting ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Memproses...</>
                    ) : (
                      <><PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Post Jurnal</>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="justify-start h-11">
                <FileBarChart className="mr-2 h-4 w-4" /> Laporan Keuangan
              </Button>
            </DialogTrigger>
            <DialogContent className={NB.contentNarrow}>
              <DialogHeader className={NB.header}>
                <DialogTitle className={NB.title}>
                  <FileBarChart className="h-5 w-5" /> Generate Laporan
                </DialogTitle>
                <p className={NB.subtitle}>Pilih jenis laporan dan periode analisis</p>
              </DialogHeader>
              <div className="p-6 space-y-5">
                <div>
                  <label className={NB.label}>Jenis Laporan <span className={NB.labelRequired}>*</span></label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {([
                      { value: "pnl" as const, label: "Profit & Loss" },
                      { value: "bs" as const, label: "Balance Sheet" },
                      { value: "cf" as const, label: "Cash Flow" },
                    ]).map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setReportType(value)}
                        className={`p-3 border-2 text-center transition-all ${
                          reportType === value
                            ? "border-black bg-zinc-900 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                            : "border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50"
                        }`}
                      >
                        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                  <div>
                    <label className={NB.label}>Dari</label>
                    <Input type="date" value={reportStart} onChange={(e) => setReportStart(e.target.value)} className={NB.inputMono} />
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-400 mb-2.5" />
                  <div>
                    <label className={NB.label}>Sampai</label>
                    <Input type="date" value={reportEnd} onChange={(e) => setReportEnd(e.target.value)} className={NB.inputMono} />
                  </div>
                </div>
                <div className={NB.footer}>
                  <Button variant="outline" className={NB.cancelBtn} onClick={() => setReportOpen(false)}>Batal</Button>
                  <Button onClick={handleOpenReport} className={NB.submitBtn}>
                    <FileBarChart className="h-3.5 w-3.5 mr-1.5" /> Buka Laporan
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href="/finance/vendor-payments">Buka Modul Pembayaran AP</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/finance/chart-accounts">Buka Chart of Accounts</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/finance/journal">Buka Jurnal Umum</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/finance/reports">Buka Laporan Keuangan</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
