"use client"

import * as React from "react"
import { IconCalculator, IconDownload, IconCheck, IconRefresh, IconFileSpreadsheet, IconPrinter, IconCash, IconReceipt, IconUsers, IconClock, IconShieldCheck, IconChevronRight, IconAlertTriangle } from "@tabler/icons-react"
import * as XLSX from "xlsx"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { approvePayrollRun, createPayrollDisbursementBatch, generatePayrollDraft, getPayrollComplianceReport, getPayrollExportData } from "@/app/actions/hcm"
import { toast } from "sonner"
import { usePayrollRun, usePayrollCompliance, type PayrollLine, type PayrollRunData } from "@/hooks/use-payroll"

export const dynamic = "force-dynamic"

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount)
}

function formatCompact(value: number): string {
  if (value === 0) return "Rp 0"
  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1)}jt`
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)}rb`
  return `${sign}Rp ${abs.toFixed(0)}`
}

const currentPeriod = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

const buildPeriodOptions = () => {
  const now = new Date()
  return Array.from({ length: 12 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    const label = date.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    return { value, label }
  })
}

const toCsv = (lines: PayrollLine[]) => {
  const rows = lines.map((line) => ({
    Kode: line.employeeCode,
    Nama: line.employeeName,
    Departemen: line.department,
    Posisi: line.position,
    HariHadir: line.attendanceDays,
    HariCuti: line.leaveDays,
    Telat: line.lateCount,
    LemburJam: line.overtimeHours,
    GajiPokok: line.basicSalary,
    TunjanganTransport: line.transportAllowance,
    TunjanganMakan: line.mealAllowance,
    TunjanganPosisi: line.positionAllowance,
    UpahLembur: line.overtimePay,
    BPJSKesehatan: line.bpjsKesehatan,
    BPJSJHT: line.bpjsJHT ?? 0,
    BPJSJP: line.bpjsJP ?? 0,
    BPJSKetenagakerjaan: line.bpjsKetenagakerjaan,
    PPh21: line.pph21,
    GajiKotor: line.grossSalary,
    TotalPotongan: line.totalDeductions,
    GajiBersih: line.netSalary,
  }))

  const headers = Object.keys(rows[0] || {})
  const csvRows = rows.map((row) =>
    headers.map((header) => `"${String((row as Record<string, string | number>)[header] ?? "").replaceAll('"', '""')}"`).join(",")
  )
  return [headers.join(","), ...csvRows].join("\n")
}

export default function PayrollPage() {
  const queryClient = useQueryClient()
  const [selectedPeriod, setSelectedPeriod] = React.useState(currentPeriod())
  const [processing, setProcessing] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)

  const periodOptions = React.useMemo(() => buildPeriodOptions(), [])

  const { data: run = null, isLoading: loading, refetch: refetchRun } = usePayrollRun(selectedPeriod)
  const { data: compliance = null, refetch: refetchCompliance } = usePayrollCompliance(selectedPeriod)

  const invalidatePayroll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.payroll.run(selectedPeriod) })
    queryClient.invalidateQueries({ queryKey: queryKeys.payroll.compliance(selectedPeriod) })
  }

  const handleGenerate = async () => {
    setProcessing(true)
    try {
      const result = await generatePayrollDraft(selectedPeriod)
      if (!result.success) {
        toast.error("error" in result ? String(result.error) : "Gagal menghitung payroll")
        return
      }

      toast.success("message" in result ? result.message : "Payroll draft berhasil dihitung")
      queryClient.invalidateQueries({ queryKey: queryKeys.hcmDashboard.all })
      invalidatePayroll()
    } catch {
      toast.error("Terjadi kesalahan saat menghitung payroll")
    } finally {
      setProcessing(false)
    }
  }

  const handleApprove = async () => {
    if (!run) return

    setProcessing(true)
    try {
      const result = await approvePayrollRun(run.period)
      if (!result.success) {
        toast.error("error" in result ? String(result.error) : "Gagal menyetujui payroll")
        return
      }

      toast.success("message" in result ? result.message : "Payroll berhasil diposting")
      queryClient.invalidateQueries({ queryKey: queryKeys.hcmDashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
      invalidatePayroll()
    } catch {
      toast.error("Terjadi kesalahan saat posting payroll")
    } finally {
      setProcessing(false)
    }
  }

  const handleExportCSV = async () => {
    if (!run || run.lines.length === 0) {
      toast.error("Belum ada data payroll untuk diekspor")
      return
    }

    setExporting(true)
    try {
      const exportResult = await getPayrollExportData(run.period)
      if (!exportResult.success || !("data" in exportResult) || !exportResult.data) {
        toast.error("error" in exportResult ? String(exportResult.error) : "Gagal menyiapkan export payroll")
        return
      }

      const csv = toCsv(exportResult.data.rows as PayrollLine[])
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `payroll-${run.period}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("CSV payroll berhasil diunduh")
    } catch {
      toast.error("Terjadi kesalahan saat export CSV")
    } finally {
      setExporting(false)
    }
  }

  const handleExportXLS = async () => {
    if (!run || run.lines.length === 0) {
      toast.error("Belum ada data payroll untuk diekspor")
      return
    }

    setExporting(true)
    try {
      const exportResult = await getPayrollExportData(run.period)
      if (!exportResult.success || !("data" in exportResult) || !exportResult.data) {
        toast.error("error" in exportResult ? String(exportResult.error) : "Gagal menyiapkan export payroll")
        return
      }

      const rows = exportResult.data.rows.map((line) => ({
        Kode: line.employeeCode,
        Nama: line.employeeName,
        Departemen: line.department,
        Posisi: line.position,
        HariHadir: line.attendanceDays,
        HariCuti: line.leaveDays,
        Telat: line.lateCount,
        LemburJam: line.overtimeHours,
        GajiPokok: line.basicSalary,
        TunjanganTransport: line.transportAllowance,
        TunjanganMakan: line.mealAllowance,
        TunjanganPosisi: line.positionAllowance,
        UpahLembur: line.overtimePay,
        BPJSKesehatan: line.bpjsKesehatan,
        BPJSJHT: line.bpjsJHT ?? 0,
        BPJSJP: line.bpjsJP ?? 0,
        BPJSKetenagakerjaan: line.bpjsKetenagakerjaan,
        PPh21: line.pph21,
        GajiKotor: line.grossSalary,
        TotalPotongan: line.totalDeductions,
        GajiBersih: line.netSalary,
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Payroll")
      XLSX.writeFile(wb, `payroll-${run.period}.xls`, { bookType: "xls" })
      toast.success("XLS payroll berhasil diunduh")
    } catch {
      toast.error("Terjadi kesalahan saat export XLS")
    } finally {
      setExporting(false)
    }
  }

  const handleOpenPayrollPDF = () => {
    if (!run) {
      toast.error("Belum ada payroll run yang dapat dicetak")
      return
    }
    const url = `/api/documents/payroll/${encodeURIComponent(run.period)}?disposition=inline`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const handleOpenPayslipPDF = (line: PayrollLine) => {
    if (!run) {
      toast.error("Belum ada payroll run")
      return
    }
    const url = `/api/documents/payslip/${encodeURIComponent(run.period)}/${encodeURIComponent(line.employeeId)}?disposition=inline`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const handleCreateDisbursement = async () => {
    if (!run) {
      toast.error("Belum ada payroll run")
      return
    }
    if (run.status !== "POSTED") {
      toast.error("Payroll harus diposting sebelum membuat disbursement")
      return
    }

    setProcessing(true)
    try {
      const result = await createPayrollDisbursementBatch(run.period, { method: "TRANSFER" })
      if (!result.success) {
        toast.error("error" in result ? String(result.error) : "Gagal membuat disbursement payroll")
        return
      }
      toast.success("message" in result ? result.message : "Batch disbursement payroll berhasil dibuat")
      queryClient.invalidateQueries({ queryKey: queryKeys.hcmDashboard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.journal.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.vendorPayments.all })
      invalidatePayroll()
    } catch {
      toast.error("Terjadi kesalahan saat membuat disbursement payroll")
    } finally {
      setProcessing(false)
    }
  }

  const handleExportComplianceCSV = async () => {
    const result = await getPayrollComplianceReport(selectedPeriod)
    if (!result.success || !("report" in result) || !result.report) {
      toast.error("Laporan compliance belum tersedia")
      return
    }

    const rows = result.report.rows || []
    if (rows.length === 0) {
      toast.error("Tidak ada data compliance untuk diekspor")
      return
    }

    const headers = ["Kode", "Nama", "Departemen", "BPJS Kesehatan", "BPJS JHT", "BPJS JP", "PPh21", "Gaji Bersih"]
    const csv = [
      headers.join(","),
      ...rows.map((row: any) =>
        [
          row.employeeCode,
          row.employeeName,
          row.department,
          row.bpjsKesehatan,
          row.bpjsJHT ?? 0,
          row.bpjsJP ?? 0,
          row.pph21,
          row.netSalary,
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `payroll-compliance-${selectedPeriod}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success("Compliance CSV berhasil diunduh")
  }

  const handleExportComplianceXLS = async () => {
    const result = await getPayrollComplianceReport(selectedPeriod)
    if (!result.success || !("report" in result) || !result.report) {
      toast.error("Laporan compliance belum tersedia")
      return
    }

    const rows = result.report.rows || []
    if (rows.length === 0) {
      toast.error("Tidak ada data compliance untuk diekspor")
      return
    }

    const ws = XLSX.utils.json_to_sheet(
      rows.map((row: any) => ({
        Kode: row.employeeCode,
        Nama: row.employeeName,
        Departemen: row.department,
        BPJSKesehatan: row.bpjsKesehatan,
        BPJSJHT: row.bpjsJHT ?? 0,
        BPJSJP: row.bpjsJP ?? 0,
        BPJSKetenagakerjaan: row.bpjsKetenagakerjaan,
        PPh21: row.pph21,
        GajiBersih: row.netSalary,
      }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Compliance")
    XLSX.writeFile(wb, `payroll-compliance-${selectedPeriod}.xls`, { bookType: "xls" })
    toast.success("Compliance XLS berhasil diunduh")
  }

  const totalGrossSalary = run?.summary.gross || 0
  const totalDeductions = run?.summary.deductions || 0
  const totalNetSalary = run?.summary.net || 0
  const employeeCount = run?.summary.employees || 0
  const totalOvertimeHours = run?.summary.overtimeHours || 0

  const selectedLabel = periodOptions.find((o) => o.value === selectedPeriod)?.label ?? selectedPeriod

  // Status logic
  const isPosted = run?.status === "POSTED"
  const isDisbursed = run?.disbursementStatus === "PAID"
  const hasDraft = !!run

  return (
    <div className="mf-page space-y-6 p-4 pt-6 md:p-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-teal-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <IconCash className="h-5 w-5 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight md:text-2xl">Pemrosesan Payroll</h1>
              <p className="text-xs font-medium text-zinc-500">Hitung gaji, approval, posting jurnal, dan disbursement</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchRun(); refetchCompliance() }}
            disabled={loading || processing}
            className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
          >
            <IconRefresh className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={processing}
            className="border-2 border-black bg-teal-500 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-teal-600 hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
          >
            <IconCalculator className="mr-1.5 h-3.5 w-3.5" />
            {processing ? "Memproses..." : "Hitung Payroll"}
          </Button>
        </div>
      </div>

      {/* ── Period Selector + Status Bar ── */}
      <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900">
        <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Periode</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="mt-1 w-[220px] border-2 border-black font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Pipeline */}
            <div className="hidden items-center gap-1 md:flex">
              <StatusStep label="Draft" active={hasDraft && !isPosted} done={isPosted} />
              <IconChevronRight className="h-3 w-3 text-zinc-300" />
              <StatusStep label="Approved" active={false} done={isPosted} />
              <IconChevronRight className="h-3 w-3 text-zinc-300" />
              <StatusStep label="Posted" active={isPosted && !isDisbursed} done={isDisbursed} />
              <IconChevronRight className="h-3 w-3 text-zinc-300" />
              <StatusStep label="Disbursed" active={isDisbursed} done={false} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {run ? (
              <Badge
                className={`border-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                  isPosted
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-amber-600 bg-amber-50 text-amber-700"
                }`}
              >
                {isPosted ? "POSTED" : "PENDING APPROVAL"}
              </Badge>
            ) : (
              <Badge className="border-2 border-zinc-300 bg-zinc-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Belum ada draft
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          label="Total Gaji Kotor"
          value={formatCompact(totalGrossSalary)}
          sub={`${employeeCount} karyawan`}
          icon={<IconReceipt className="h-4 w-4" />}
          accent="bg-blue-400"
        />
        <KpiCard
          label="Total Potongan"
          value={formatCompact(totalDeductions)}
          sub="BPJS + PPh21"
          icon={<IconShieldCheck className="h-4 w-4" />}
          accent="bg-rose-400"
        />
        <KpiCard
          label="Gaji Bersih"
          value={formatCompact(totalNetSalary)}
          sub="Siap dibayarkan"
          icon={<IconCash className="h-4 w-4" />}
          accent="bg-emerald-400"
        />
        <KpiCard
          label="Total Lembur"
          value={`${totalOvertimeHours} jam`}
          sub={`${employeeCount} karyawan`}
          icon={<IconClock className="h-4 w-4" />}
          accent="bg-amber-400"
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-4 border-2 border-black bg-zinc-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-800">
          <TabsTrigger value="current" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-none">Payroll Berjalan</TabsTrigger>
          <TabsTrigger value="calculation" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-none">Perhitungan</TabsTrigger>
          <TabsTrigger value="reports" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-none">Laporan</TabsTrigger>
          <TabsTrigger value="settings" className="font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-none">Pengaturan</TabsTrigger>
        </TabsList>

        {/* ── TAB: Payroll Berjalan ── */}
        <TabsContent value="current" className="mt-4 space-y-4">
          {/* Action bar */}
          {run && !isPosted && (
            <div className="flex items-center justify-between border-2 border-amber-400 bg-amber-50 p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2">
                <IconAlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-800">
                  Payroll {selectedLabel} menunggu approval — {employeeCount} karyawan, total {formatCompact(totalNetSalary)}
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={processing}
                className="border-2 border-black bg-emerald-500 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-emerald-600 hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
              >
                <IconCheck className="mr-1.5 h-3.5 w-3.5" />
                Approve & Post Jurnal
              </Button>
            </div>
          )}

          {isPosted && !isDisbursed && (
            <div className="flex items-center justify-between border-2 border-emerald-400 bg-emerald-50 p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2">
                <IconCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-800">
                  Payroll sudah diposting ke jurnal. Siap untuk disbursement.
                </span>
              </div>
              <Button
                size="sm"
                onClick={handleCreateDisbursement}
                disabled={processing}
                className="border-2 border-black bg-blue-500 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-600 hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold"
              >
                <IconCash className="mr-1.5 h-3.5 w-3.5" />
                Buat Batch Disbursement
              </Button>
            </div>
          )}

          {/* Detail Table */}
          <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b-2 border-black p-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest">Detail Payroll</h2>
                <p className="text-[10px] font-medium text-zinc-500">{run?.periodLabel || selectedLabel}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  disabled={exporting || !run}
                  className="border-2 border-black text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  <IconDownload className="mr-1 h-3 w-3" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportXLS}
                  disabled={exporting || !run}
                  className="border-2 border-black text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  <IconFileSpreadsheet className="mr-1 h-3 w-3" />
                  XLS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenPayrollPDF}
                  disabled={!run || loading}
                  className="border-2 border-black text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  <IconPrinter className="mr-1 h-3 w-3" />
                  PDF
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Karyawan</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Gaji Pokok</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Tunjangan</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Lembur</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">BPJS</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">PPh21</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Gaji Bersih</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Slip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                          <span className="text-xs font-bold text-zinc-500">Memuat data payroll...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : !run || run.lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center border-2 border-zinc-200 bg-zinc-50">
                            <IconUsers className="h-6 w-6 text-zinc-300" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-600">Belum ada payroll draft</p>
                            <p className="text-[10px] text-zinc-400">Klik &quot;Hitung Payroll&quot; untuk memulai perhitungan periode ini</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    run.lines.map((line, i) => (
                      <TableRow key={line.employeeId} className={`border-b border-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${i % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-800/30"}`}>
                        <TableCell className="py-3">
                          <div>
                            <div className="text-sm font-bold">{line.employeeName}</div>
                            <div className="text-[10px] text-zinc-500">{line.employeeCode} &middot; {line.department}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatCurrency(line.basicSalary)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{formatCurrency(line.transportAllowance + line.mealAllowance + line.positionAllowance)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {line.overtimePay > 0 ? (
                            <span className="text-amber-600">{formatCurrency(line.overtimePay)}</span>
                          ) : (
                            <span className="text-zinc-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-rose-600">{formatCurrency(line.bpjsKesehatan + line.bpjsKetenagakerjaan)}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-rose-600">{formatCurrency(line.pph21)}</TableCell>
                        <TableCell className="text-right text-sm font-black tabular-nums">{formatCurrency(line.netSalary)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPayslipPDF(line)}
                            className="h-7 border-2 border-black px-2 text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                          >
                            <IconDownload className="mr-1 h-3 w-3" />
                            PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Table footer with totals */}
            {run && run.lines.length > 0 && (
              <div className="border-t-2 border-black bg-zinc-50 p-4 dark:bg-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Total {employeeCount} Karyawan</span>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase text-zinc-400">Gaji Kotor</div>
                      <div className="text-sm font-black tabular-nums">{formatCurrency(totalGrossSalary)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase text-zinc-400">Potongan</div>
                      <div className="text-sm font-black tabular-nums text-rose-600">{formatCurrency(totalDeductions)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase text-zinc-400">Gaji Bersih</div>
                      <div className="text-lg font-black tabular-nums text-emerald-600">{formatCurrency(totalNetSalary)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB: Perhitungan ── */}
        <TabsContent value="calculation" className="mt-4 space-y-4">
          <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900">
            <div className="border-b-2 border-black p-4">
              <h2 className="text-sm font-black uppercase tracking-widest">Formula Payroll Aktif</h2>
              <p className="text-[10px] text-zinc-500">Formula otomatis saat &quot;Hitung Payroll&quot; dijalankan &mdash; sesuai regulasi Indonesia</p>
            </div>
            <div className="grid gap-0 md:grid-cols-3">
              {/* Tunjangan */}
              <div className="border-b-2 border-black p-5 md:border-b-0 md:border-r-2">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center border-2 border-black bg-blue-100">
                    <IconReceipt className="h-3.5 w-3.5 text-blue-700" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Tunjangan</span>
                </div>
                <div className="space-y-2 text-sm">
                  <FormulaRow label="Transport" value="7% gaji pokok" />
                  <FormulaRow label="Makan" value="3% gaji pokok" />
                  <FormulaRow label="Posisi" value="10% gaji pokok" />
                </div>
              </div>

              {/* BPJS */}
              <div className="border-b-2 border-black p-5 md:border-b-0 md:border-r-2">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center border-2 border-black bg-rose-100">
                    <IconShieldCheck className="h-3.5 w-3.5 text-rose-700" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">BPJS Karyawan</span>
                </div>
                <div className="space-y-2 text-sm">
                  <FormulaRow label="Kesehatan" value="1% (maks Rp 12jt basis)" />
                  <FormulaRow label="JHT" value="2% gaji pokok" />
                  <FormulaRow label="JP" value="1% (maks Rp 9.5jt basis)" />
                </div>
              </div>

              {/* PPh21 */}
              <div className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center border-2 border-black bg-amber-100">
                    <IconReceipt className="h-3.5 w-3.5 text-amber-700" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">PPh 21 (UU HPP)</span>
                </div>
                <div className="space-y-2 text-sm">
                  <FormulaRow label="0 - 60jt" value="5%" />
                  <FormulaRow label="60jt - 250jt" value="15%" />
                  <FormulaRow label="250jt - 500jt" value="25%" />
                  <FormulaRow label="500jt - 5M" value="30%" />
                  <FormulaRow label="> 5M" value="35%" />
                  <div className="mt-2 text-[10px] text-zinc-400">PTKP TK/0: Rp 54.000.000/tahun</div>
                </div>
              </div>
            </div>
          </div>

          {/* Overtime Formula */}
          <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900">
            <div className="border-b-2 border-black p-4">
              <h2 className="text-sm font-black uppercase tracking-widest">Formula Lembur</h2>
              <p className="text-[10px] text-zinc-500">Kepmenaker 102/MEN/VI/2004</p>
            </div>
            <div className="grid gap-0 md:grid-cols-2">
              <div className="border-b-2 border-black p-5 md:border-b-0 md:border-r-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Hari Kerja</span>
                <div className="mt-2 space-y-2 text-sm">
                  <FormulaRow label="Jam ke-1" value="1.5x upah/jam" />
                  <FormulaRow label="Jam ke-2+" value="2x upah/jam" />
                  <FormulaRow label="Maks" value="3 jam/hari" />
                </div>
              </div>
              <div className="p-5">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Upah Per Jam</span>
                <div className="mt-2 space-y-2 text-sm">
                  <FormulaRow label="Formula" value="Gaji Pokok / 173 jam" />
                  <div className="text-[10px] text-zinc-400">173 = 40 jam/minggu x 52 minggu / 12 bulan</div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB: Laporan ── */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900">
            <div className="border-b-2 border-black p-4">
              <h2 className="text-sm font-black uppercase tracking-widest">Laporan Payroll</h2>
              <p className="text-[10px] text-zinc-500">Status posting dan dokumen payroll</p>
            </div>

            {!run ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="flex h-12 w-12 items-center justify-center border-2 border-zinc-200 bg-zinc-50">
                  <IconReceipt className="h-6 w-6 text-zinc-300" />
                </div>
                <p className="text-sm font-bold text-zinc-400">Belum ada payroll run untuk periode ini</p>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Report Info Grid */}
                <div className="grid gap-4 md:grid-cols-3">
                  <InfoItem label="Periode" value={run.periodLabel} />
                  <InfoItem label="Generated" value={new Date(run.generatedAt).toLocaleString("id-ID")} />
                  <InfoItem label="Approver" value={run.approverName} />
                  <InfoItem label="Status" value={run.status} badge={isPosted ? "emerald" : "amber"} />
                  <InfoItem label="Jurnal Reference" value={run.postedJournalReference || "-"} />
                  <InfoItem label="Disbursement" value={run.disbursementStatus || "PENDING"} badge={isDisbursed ? "emerald" : "zinc"} />
                </div>

                {/* Export Buttons */}
                <div className="flex flex-wrap gap-2 border-t-2 border-zinc-100 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenPayrollPDF}
                    className="border-2 border-black text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  >
                    <IconPrinter className="mr-1 h-3 w-3" />
                    Unduh PDF Payroll
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportXLS}
                    disabled={exporting}
                    className="border-2 border-black text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  >
                    <IconFileSpreadsheet className="mr-1 h-3 w-3" />
                    Unduh XLS
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    disabled={exporting}
                    className="border-2 border-black text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  >
                    <IconDownload className="mr-1 h-3 w-3" />
                    Unduh CSV
                  </Button>
                  {isPosted && !isDisbursed && (
                    <Button
                      size="sm"
                      onClick={handleCreateDisbursement}
                      disabled={processing}
                      className="border-2 border-black bg-blue-500 text-white text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-600 hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                      <IconCash className="mr-1 h-3 w-3" />
                      Buat Batch Disbursement
                    </Button>
                  )}
                </div>

                {/* Compliance Section */}
                {compliance && (
                  <div className="border-2 border-black bg-zinc-50 p-4 dark:bg-zinc-800">
                    <div className="mb-3 flex items-center gap-2">
                      <IconShieldCheck className="h-4 w-4 text-zinc-600" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Ringkasan Compliance</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <ComplianceMetric label="BPJS Kesehatan" value={formatCurrency(compliance.totals.bpjsKesehatan)} />
                      <ComplianceMetric label="BPJS JHT" value={formatCurrency(compliance.totals.bpjsJHT ?? 0)} />
                      <ComplianceMetric label="BPJS JP" value={formatCurrency(compliance.totals.bpjsJP ?? 0)} />
                      <ComplianceMetric label="PPh21" value={formatCurrency(compliance.totals.pph21)} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportComplianceCSV}
                        className="border-2 border-black text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                      >
                        <IconDownload className="mr-1 h-3 w-3" />
                        Compliance CSV
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportComplianceXLS}
                        className="border-2 border-black text-[10px] font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                      >
                        <IconFileSpreadsheet className="mr-1 h-3 w-3" />
                        Compliance XLS
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB: Pengaturan ── */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900">
            <div className="border-b-2 border-black p-4">
              <h2 className="text-sm font-black uppercase tracking-widest">Pengaturan Payroll</h2>
              <p className="text-[10px] text-zinc-500">Konfigurasi perhitungan payroll</p>
            </div>
            <div className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <SettingItem label="Cut-off Tanggal" value="25 setiap bulan" description="Periode penghitungan gaji dimulai dari tanggal 26 bulan sebelumnya" />
                <SettingItem label="PTKP" value="TK/0 — Rp 54.000.000/tahun" description="Penghasilan Tidak Kena Pajak untuk karyawan belum menikah" />
                <SettingItem label="Metode Pembulatan" value="Math.round (standar)" description="Pembulatan ke angka terdekat untuk semua komponen gaji" />
                <SettingItem label="Formula Version" value="2026.02" description="Versi formula kalkulasi yang digunakan saat ini" />
              </div>
              <div className="mt-4 border-t-2 border-zinc-100 pt-4">
                <p className="text-[10px] font-bold text-zinc-400">Pengaturan lanjutan (konfigurasi per karyawan, PTKP per status pernikahan, custom tunjangan) akan tersedia di update berikutnya.</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Sub-components ──

function StatusStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div
      className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-colors ${
        done
          ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-700"
          : active
            ? "border-2 border-black bg-amber-50 text-amber-700"
            : "border-2 border-zinc-200 bg-zinc-50 text-zinc-400"
      }`}
    >
      {label}
    </div>
  )
}

function KpiCard({ label, value, sub, icon, accent }: { label: string; value: string; sub: string; icon: React.ReactNode; accent: string }) {
  return (
    <div className="group relative border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900">
      <div className={`absolute left-0 right-0 top-0 h-1 ${accent}`} />
      <div className="mb-2 flex items-center gap-2">
        <span className="text-zinc-400">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
      <div className="text-2xl font-black tracking-tighter text-zinc-900 dark:text-white md:text-3xl">
        {value === "Rp 0" || value === "0 jam" ? (
          <span className="text-lg text-zinc-300 dark:text-zinc-700">Belum ada data</span>
        ) : (
          value
        )}
      </div>
      <div className="mt-1 text-[10px] font-bold tracking-wide text-zinc-400">{sub}</div>
    </div>
  )
}

function FormulaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-600">{label}</span>
      <span className="font-bold text-zinc-900 dark:text-white">{value}</span>
    </div>
  )
}

function InfoItem({ label, value, badge }: { label: string; value: string; badge?: "emerald" | "amber" | "zinc" }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</div>
      {badge ? (
        <Badge
          className={`mt-1 border-2 px-2 py-0.5 text-[10px] font-black uppercase ${
            badge === "emerald"
              ? "border-emerald-600 bg-emerald-50 text-emerald-700"
              : badge === "amber"
                ? "border-amber-600 bg-amber-50 text-amber-700"
                : "border-zinc-300 bg-zinc-50 text-zinc-600"
          }`}
        >
          {value}
        </Badge>
      ) : (
        <div className="mt-1 text-sm font-bold text-zinc-800 dark:text-zinc-200">{value}</div>
      )}
    </div>
  )
}

function ComplianceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-zinc-500">{label}</div>
      <div className="text-sm font-black tabular-nums text-zinc-900 dark:text-white">{value}</div>
    </div>
  )
}

function SettingItem({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="border-2 border-zinc-200 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-zinc-900 dark:text-white">{value}</div>
      <div className="mt-1 text-[10px] text-zinc-400">{description}</div>
    </div>
  )
}
