"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { PlusCircle, Receipt, BookOpenText, FileSpreadsheet, FileBarChart } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Pembayaran AP</DialogTitle>
                <DialogDescription>Catat pembayaran vendor dan link ke tagihan bila tersedia.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Vendor</Label>
                  <Select value={apSupplierId} onValueChange={setApSupplierId} disabled={loadingMaster}>
                    <SelectTrigger><SelectValue placeholder="Pilih vendor" /></SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tagihan (Opsional)</Label>
                  <Select value={apBillId} onValueChange={setApBillId}>
                    <SelectTrigger><SelectValue placeholder="Pilih tagihan" /></SelectTrigger>
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
                  <div className="space-y-1.5">
                    <Label>Jumlah</Label>
                    <Input type="number" min="0" value={apAmount} onChange={(e) => setApAmount(e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Metode</Label>
                    <Select value={apMethod} onValueChange={(value) => setApMethod(value as "CASH" | "TRANSFER" | "CHECK")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TRANSFER">Transfer</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="CHECK">Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Referensi</Label>
                  <Input value={apReference} onChange={(e) => setApReference(e.target.value)} placeholder="No. referensi pembayaran" />
                </div>
                <Button onClick={handleCreateAPPayment} disabled={apSubmitting} className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" /> {apSubmitting ? "Menyimpan..." : "Simpan Pembayaran AP"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={coaOpen} onOpenChange={setCoaOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="justify-start h-11">
                <BookOpenText className="mr-2 h-4 w-4" /> Chart of Accounts
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Akun COA</DialogTitle>
                <DialogDescription>Buat akun baru sesuai struktur Chart of Accounts.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Kode Akun</Label>
                    <Input value={coaCode} onChange={(e) => setCoaCode(e.target.value)} placeholder="Contoh: 6100" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipe</Label>
                    <Select value={coaType} onValueChange={(value) => setCoaType(value as "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE") }>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ASSET">ASSET</SelectItem>
                        <SelectItem value="LIABILITY">LIABILITY</SelectItem>
                        <SelectItem value="EQUITY">EQUITY</SelectItem>
                        <SelectItem value="REVENUE">REVENUE</SelectItem>
                        <SelectItem value="EXPENSE">EXPENSE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Nama Akun</Label>
                  <Input value={coaName} onChange={(e) => setCoaName(e.target.value)} placeholder="Contoh: Biaya Operasional" />
                </div>
                <Button onClick={handleCreateAccount} disabled={coaSubmitting} className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" /> {coaSubmitting ? "Menyimpan..." : "Simpan Akun COA"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={journalOpen} onOpenChange={setJournalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="justify-start h-11">
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Jurnal Umum
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Posting Jurnal Umum</DialogTitle>
                <DialogDescription>Form entri cepat jurnal dengan debit dan kredit seimbang.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Deskripsi</Label>
                  <Input value={journalDescription} onChange={(e) => setJournalDescription(e.target.value)} placeholder="Contoh: Beban listrik bulan ini" />
                </div>
                <div className="space-y-1.5">
                  <Label>Referensi</Label>
                  <Input value={journalReference} onChange={(e) => setJournalReference(e.target.value)} placeholder="Opsional" />
                </div>
                <div className="space-y-1.5">
                  <Label>Akun Debit</Label>
                  <Select value={journalDebitAccount} onValueChange={setJournalDebitAccount}>
                    <SelectTrigger><SelectValue placeholder="Pilih akun debit" /></SelectTrigger>
                    <SelectContent>
                      {glAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Akun Kredit</Label>
                  <Select value={journalCreditAccount} onValueChange={setJournalCreditAccount}>
                    <SelectTrigger><SelectValue placeholder="Pilih akun kredit" /></SelectTrigger>
                    <SelectContent>
                      {glAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>{account.code} - {account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nominal</Label>
                  <Input type="number" min="0" value={journalAmount} onChange={(e) => setJournalAmount(e.target.value)} placeholder="0" />
                </div>
                <Button onClick={handleCreateJournal} disabled={journalSubmitting} className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" /> {journalSubmitting ? "Memproses..." : "Post Jurnal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="justify-start h-11">
                <FileBarChart className="mr-2 h-4 w-4" /> Laporan Keuangan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Laporan Keuangan</DialogTitle>
                <DialogDescription>Tentukan periode dan jenis laporan untuk analisis finance.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Jenis Laporan</Label>
                  <Select value={reportType} onValueChange={(value) => setReportType(value as "pnl" | "bs" | "cf") }>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pnl">Profit & Loss</SelectItem>
                      <SelectItem value="bs">Balance Sheet</SelectItem>
                      <SelectItem value="cf">Cash Flow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tanggal Mulai</Label>
                    <Input type="date" value={reportStart} onChange={(e) => setReportStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tanggal Akhir</Label>
                    <Input type="date" value={reportEnd} onChange={(e) => setReportEnd(e.target.value)} />
                  </div>
                </div>
                <Button onClick={handleOpenReport} className="w-full">
                  Buka Laporan
                </Button>
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
