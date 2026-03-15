"use client"

import * as React from "react"
import { IconCalculator, IconDownload, IconCheck, IconRefresh, IconFileSpreadsheet, IconPrinter, IconCash, IconReceipt, IconUsers, IconClock, IconShieldCheck, IconChevronRight, IconAlertTriangle } from "@tabler/icons-react"
import * as XLSX from "xlsx"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { approvePayrollRun, createPayrollDisbursementBatch, generatePayrollDraft, getPayrollComplianceReport, getPayrollExportData } from "@/app/actions/hcm"
import { toast } from "sonner"
import { usePayrollRun, usePayrollCompliance, type PayrollLine, type PayrollRunData } from "@/hooks/use-payroll"
import { NB } from "@/lib/dialog-styles"
import { Eye, EyeOff } from "lucide-react"

export const dynamic = "force-dynamic"

/* ─── Animation variants ─── */
const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 26 } },
}
const fadeX = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 320, damping: 26 } },
}

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
  const [showAmounts, setShowAmounts] = React.useState(true)

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

  const totalGrossSalary = run?.summary?.gross || 0
  const totalDeductions = run?.summary?.deductions || 0
  const totalNetSalary = run?.summary?.net || 0
  const employeeCount = run?.summary?.employees || 0
  const totalOvertimeHours = run?.summary?.overtimeHours || 0

  const selectedLabel = periodOptions.find((o) => o.value === selectedPeriod)?.label ?? selectedPeriod

  // Status logic
  const isPosted = run?.status === "POSTED"
  const isDisbursed = run?.disbursementStatus === "PAID"
  const hasDraft = !!run

  return (
    <motion.div
      className="mf-page"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* ─── Unified Page Header Card ─── */}
      <motion.div
        variants={fadeUp}
        className={NB.pageCard}
      >
        {/* Orange accent bar */}
        <div className={NB.pageAccent} />

        {/* Row 1: Title + Toolbar Actions */}
        <div className={`px-5 py-3.5 flex items-center justify-between ${NB.pageRowBorder}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 flex items-center justify-center">
              <IconCash className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                Pemrosesan Payroll
              </h1>
              <p className="text-zinc-400 text-[11px] font-medium">
                Hitung gaji, approval, posting jurnal, dan disbursement
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0">
            <Button
              variant="outline"
              onClick={() => { refetchRun(); refetchCompliance() }}
              disabled={loading || processing}
              className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}
            >
              <IconRefresh className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={exporting || !run}
              className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}
            >
              <IconDownload className="h-3.5 w-3.5 mr-1.5" /> CSV
            </Button>
            <Button
              variant="outline"
              onClick={handleExportXLS}
              disabled={exporting || !run}
              className={`${NB.toolbarBtn} ${NB.toolbarBtnJoin}`}
            >
              <IconFileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> XLS
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenPayrollPDF}
              disabled={!run || loading}
              className={NB.toolbarBtn}
            >
              <IconPrinter className="h-3.5 w-3.5 mr-1.5" /> PDF
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={processing}
              className={NB.toolbarBtnPrimary}
            >
              <IconCalculator className="h-3.5 w-3.5 mr-1.5" />
              {processing ? "Memproses..." : "Hitung Payroll"}
            </Button>
          </div>
        </div>

        {/* Row 2: KPI Summary Strip */}
        <div className={`flex items-center divide-x divide-zinc-200 dark:divide-zinc-800 ${NB.pageRowBorder}`}>
          {[
            { label: "Karyawan", count: employeeCount, amount: null, color: "orange" },
            { label: "Gaji Kotor", count: null, amount: totalGrossSalary, color: "blue" },
            { label: "Potongan", count: null, amount: totalDeductions, color: "red" },
            { label: "Gaji Bersih", count: null, amount: totalNetSalary, color: "emerald" },
            { label: "Lembur", count: totalOvertimeHours, suffix: " jam", amount: null, color: "zinc" },
          ].map((kpi) => (
            <div key={kpi.label} className={NB.kpiCell}>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 ${
                  kpi.color === "orange" ? "bg-orange-500" :
                  kpi.color === "blue" ? "bg-blue-500" :
                  kpi.color === "red" ? "bg-red-500" :
                  kpi.color === "emerald" ? "bg-emerald-500" : "bg-zinc-400"
                }`} />
                <span className={NB.kpiLabel}>{kpi.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {kpi.count !== null ? (
                  <motion.span
                    key={kpi.count}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className={NB.kpiCount}
                  >
                    {kpi.count}{"suffix" in kpi ? kpi.suffix : ""}
                  </motion.span>
                ) : (
                  <AnimatePresence mode="wait">
                    {showAmounts ? (
                      <motion.span
                        key="amount"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={`text-lg font-black ${
                          kpi.color === "blue" ? "text-blue-600 dark:text-blue-400" :
                          kpi.color === "red" ? "text-red-600 dark:text-red-400" :
                          "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {formatCompact(kpi.amount!)}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-lg font-black text-zinc-300 dark:text-zinc-600"
                      >
                        *** ***
                      </motion.span>
                    )}
                  </AnimatePresence>
                )}
                {kpi.amount !== null && (
                  <button
                    onClick={() => setShowAmounts(!showAmounts)}
                    className="p-0.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
                    title={showAmounts ? "Sembunyikan nominal" : "Tampilkan nominal"}
                  >
                    {showAmounts ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Row 3: Period Selector + Status Pipeline */}
        <div className={NB.filterBar}>
          <div className="flex items-center gap-4">
            {/* Period */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Periode</span>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[200px] border border-zinc-300 dark:border-zinc-700 font-bold h-9 rounded-none text-xs bg-white dark:bg-zinc-900">
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
            <div className="hidden md:flex items-center gap-1 ml-4">
              <StatusStep label="Draft" active={hasDraft && !isPosted} done={isPosted} />
              <IconChevronRight className="h-3 w-3 text-zinc-300" />
              <StatusStep label="Approved" active={false} done={isPosted} />
              <IconChevronRight className="h-3 w-3 text-zinc-300" />
              <StatusStep label="Posted" active={isPosted && !isDisbursed} done={isDisbursed} />
              <IconChevronRight className="h-3 w-3 text-zinc-300" />
              <StatusStep label="Disbursed" active={isDisbursed} done={false} />
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            {run ? (
              <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide px-2 py-1 border rounded-none ${
                isPosted
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-amber-50 border-amber-300 text-amber-700"
              }`}>
                <span className={`w-1.5 h-1.5 ${isPosted ? "bg-emerald-500" : "bg-amber-500"}`} />
                {isPosted ? "POSTED" : "PENDING APPROVAL"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide px-2 py-1 border border-zinc-300 rounded-none bg-zinc-50 text-zinc-500">
                <span className="w-1.5 h-1.5 bg-zinc-400" />
                Belum ada draft
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* ─── Alert Bars ─── */}
      <AnimatePresence>
        {run && !isPosted && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between border-2 border-amber-400 bg-amber-50 p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-800">
                Payroll {selectedLabel} menunggu approval — {employeeCount} karyawan, total {formatCompact(totalNetSalary)}
              </span>
            </div>
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={processing}
                className={NB.submitBtnGreen + " !h-8 !px-4 !text-[10px]"}
              >
                <IconCheck className="mr-1.5 h-3.5 w-3.5" />
                Approve & Post Jurnal
              </Button>
            </motion.div>
          </motion.div>
        )}

        {isPosted && !isDisbursed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between border-2 border-emerald-400 bg-emerald-50 p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="flex items-center gap-2">
              <IconCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-800">
                Payroll sudah diposting ke jurnal. Siap untuk disbursement.
              </span>
            </div>
            <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="sm"
                onClick={handleCreateDisbursement}
                disabled={processing}
                className={NB.submitBtnBlue + " !h-8 !px-4 !text-[10px]"}
              >
                <IconCash className="mr-1.5 h-3.5 w-3.5" />
                Buat Batch Disbursement
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Tabs ─── */}
      <motion.div variants={fadeUp}>
        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-4 border-2 border-black bg-zinc-100 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-800 rounded-none h-10">
            <TabsTrigger value="current" className="font-bold text-[10px] uppercase tracking-wider rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none">Payroll Berjalan</TabsTrigger>
            <TabsTrigger value="calculation" className="font-bold text-[10px] uppercase tracking-wider rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none">Perhitungan</TabsTrigger>
            <TabsTrigger value="reports" className="font-bold text-[10px] uppercase tracking-wider rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none">Laporan</TabsTrigger>
            <TabsTrigger value="settings" className="font-bold text-[10px] uppercase tracking-wider rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none">Pengaturan</TabsTrigger>
          </TabsList>

          {/* ── TAB: Payroll Berjalan ── */}
          <TabsContent value="current" className="mt-4">
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_90px_90px_90px_1fr_70px] gap-2 px-5 py-2.5 bg-black dark:bg-zinc-950 border-b-2 border-black">
                {["Karyawan", "Gaji Pokok", "Tunjangan", "Lembur", "BPJS", "PPh21", "Gaji Bersih", "Slip"].map((h) => (
                  <span key={h} className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{h}</span>
                ))}
              </div>

              {/* Table Body */}
              <div className="w-full flex-1 flex flex-col">
                {loading ? (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="grid grid-cols-[1.5fr_1fr_1fr_90px_90px_90px_1fr_70px] gap-2 px-5 py-3.5 items-center animate-pulse">
                        <div className="space-y-1"><div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded-sm" /><div className="h-3 w-24 bg-zinc-100 dark:bg-zinc-800 rounded-sm" /></div>
                        <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                        <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                        <div className="h-4 w-14 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                        <div className="h-4 w-14 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                        <div className="h-4 w-14 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                        <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
                        <div className="h-7 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-sm" />
                      </div>
                    ))}
                  </div>
                ) : !run || run.lines.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="flex-1 flex flex-col items-center justify-center py-16 text-zinc-400"
                  >
                    <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4">
                      <IconUsers className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                    </div>
                    <span className="text-sm font-bold">Belum ada payroll draft</span>
                    <span className="text-xs text-zinc-400 mt-1">Klik &quot;Hitung Payroll&quot; untuk memulai perhitungan periode ini</span>
                  </motion.div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {run.lines.map((line, idx) => (
                      <motion.div
                        key={line.employeeId}
                        custom={idx}
                        variants={fadeX}
                        initial="hidden"
                        animate="show"
                        transition={{ delay: idx * 0.03 }}
                        className={`grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_90px_90px_90px_1fr_70px] gap-2 px-5 py-3 items-center transition-all hover:bg-orange-50/50 dark:hover:bg-orange-950/10 ${idx % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/60 dark:bg-zinc-800/20"}`}
                      >
                        <div>
                          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{line.employeeName}</div>
                          <div className="text-[10px] text-zinc-500">{line.employeeCode} &middot; {line.department}</div>
                        </div>
                        <div><span className="font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">{formatCurrency(line.basicSalary)}</span></div>
                        <div><span className="font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">{formatCurrency(line.transportAllowance + line.mealAllowance + line.positionAllowance)}</span></div>
                        <div>
                          {line.overtimePay > 0 ? (
                            <span className="font-mono text-sm tabular-nums text-amber-600">{formatCurrency(line.overtimePay)}</span>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-600">-</span>
                          )}
                        </div>
                        <div><span className="font-mono text-sm tabular-nums text-red-600 dark:text-red-400">{formatCurrency(line.bpjsKesehatan + line.bpjsKetenagakerjaan)}</span></div>
                        <div><span className="font-mono text-sm tabular-nums text-red-600 dark:text-red-400">{formatCurrency(line.pph21)}</span></div>
                        <div><span className="font-mono text-sm font-black tabular-nums text-zinc-900 dark:text-zinc-100">{formatCurrency(line.netSalary)}</span></div>
                        <div>
                          <motion.button
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => handleOpenPayslipPDF(line)}
                            className="h-7 px-2 flex items-center justify-center border border-zinc-300 dark:border-zinc-600 text-zinc-500 text-[9px] font-black uppercase tracking-wider hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-500 transition-colors rounded-none"
                          >
                            <IconDownload className="h-3 w-3 mr-1" /> PDF
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Table Footer with Totals */}
              {run && run.lines.length > 0 && (
                <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                  <span className={NB.label + " !mb-0 !text-[10px]"}>
                    {employeeCount} karyawan
                  </span>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase text-zinc-400">Gaji Kotor</div>
                      <div className="text-sm font-black tabular-nums font-mono">{formatCurrency(totalGrossSalary)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase text-zinc-400">Potongan</div>
                      <div className="text-sm font-black tabular-nums font-mono text-red-600">{formatCurrency(totalDeductions)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase text-zinc-400">Gaji Bersih</div>
                      <div className="text-lg font-black tabular-nums font-mono text-emerald-600">{formatCurrency(totalNetSalary)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── TAB: Perhitungan ── */}
          <TabsContent value="calculation" className="mt-4 space-y-4">
            <motion.div variants={fadeUp} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="hidden md:grid grid-cols-[1fr_1fr_1fr] bg-black dark:bg-zinc-950 border-b-2 border-black">
                {["Tunjangan", "BPJS Karyawan", "PPh 21 (UU HPP)"].map((h) => (
                  <span key={h} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-r border-zinc-800 last:border-r-0">{h}</span>
                ))}
              </div>
              <div className="grid gap-0 md:grid-cols-3">
                <div className="border-b border-zinc-200 p-5 md:border-b-0 md:border-r">
                  <div className="space-y-2 text-sm">
                    <FormulaRow label="Transport" value="7% gaji pokok" />
                    <FormulaRow label="Makan" value="3% gaji pokok" />
                    <FormulaRow label="Posisi" value="10% gaji pokok" />
                  </div>
                </div>
                <div className="border-b border-zinc-200 p-5 md:border-b-0 md:border-r">
                  <div className="space-y-2 text-sm">
                    <FormulaRow label="Kesehatan" value="1% (maks Rp 12jt basis)" />
                    <FormulaRow label="JHT" value="2% gaji pokok" />
                    <FormulaRow label="JP" value="1% (maks Rp 9.5jt basis)" />
                  </div>
                </div>
                <div className="p-5">
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
            </motion.div>

            {/* Overtime Formula */}
            <motion.div variants={fadeUp} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="hidden md:grid grid-cols-2 bg-black dark:bg-zinc-950 border-b-2 border-black">
                {["Lembur Hari Kerja", "Upah Per Jam"].map((h) => (
                  <span key={h} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-r border-zinc-800 last:border-r-0">{h}</span>
                ))}
              </div>
              <div className="grid gap-0 md:grid-cols-2">
                <div className="border-b border-zinc-200 p-5 md:border-b-0 md:border-r">
                  <div className="space-y-2 text-sm">
                    <FormulaRow label="Jam ke-1" value="1.5x upah/jam" />
                    <FormulaRow label="Jam ke-2+" value="2x upah/jam" />
                    <FormulaRow label="Maks" value="3 jam/hari" />
                  </div>
                  <div className="mt-2 text-[10px] text-zinc-400">Kepmenaker 102/MEN/VI/2004</div>
                </div>
                <div className="p-5">
                  <div className="space-y-2 text-sm">
                    <FormulaRow label="Formula" value="Gaji Pokok / 173 jam" />
                    <div className="text-[10px] text-zinc-400">173 = 40 jam/minggu x 52 minggu / 12 bulan</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </TabsContent>

          {/* ── TAB: Laporan ── */}
          <TabsContent value="reports" className="mt-4">
            <motion.div variants={fadeUp} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="px-5 py-2.5 bg-black dark:bg-zinc-950 border-b-2 border-black">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Laporan Payroll — {selectedLabel}</span>
              </div>

              {!run ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 flex flex-col items-center justify-center py-16 text-zinc-400"
                >
                  <div className="w-16 h-16 border-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-center mb-4">
                    <IconReceipt className="h-7 w-7 text-zinc-200 dark:text-zinc-700" />
                  </div>
                  <span className="text-sm font-bold">Belum ada payroll run untuk periode ini</span>
                </motion.div>
              ) : (
                <div className="p-5 space-y-4">
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
                  <div className="flex flex-wrap gap-2 border-t border-zinc-200 dark:border-zinc-700 pt-4">
                    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}>
                      <Button variant="outline" size="sm" onClick={handleOpenPayrollPDF} className={NB.toolbarBtn}>
                        <IconPrinter className="mr-1 h-3 w-3" /> Unduh PDF Payroll
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}>
                      <Button variant="outline" size="sm" onClick={handleExportXLS} disabled={exporting} className={NB.toolbarBtn}>
                        <IconFileSpreadsheet className="mr-1 h-3 w-3" /> Unduh XLS
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}>
                      <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={exporting} className={NB.toolbarBtn}>
                        <IconDownload className="mr-1 h-3 w-3" /> Unduh CSV
                      </Button>
                    </motion.div>
                    {isPosted && !isDisbursed && (
                      <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}>
                        <Button size="sm" onClick={handleCreateDisbursement} disabled={processing} className={NB.toolbarBtnPrimary + " !ml-0"}>
                          <IconCash className="mr-1 h-3 w-3" /> Buat Batch Disbursement
                        </Button>
                      </motion.div>
                    )}
                  </div>

                  {/* Compliance Section */}
                  {compliance && (
                    <div className="border-2 border-black p-4">
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
                        <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}>
                          <Button variant="outline" size="sm" onClick={handleExportComplianceCSV} className={NB.toolbarBtn}>
                            <IconDownload className="mr-1 h-3 w-3" /> Compliance CSV
                          </Button>
                        </motion.div>
                        <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }}>
                          <Button variant="outline" size="sm" onClick={handleExportComplianceXLS} className={NB.toolbarBtn}>
                            <IconFileSpreadsheet className="mr-1 h-3 w-3" /> Compliance XLS
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* ── TAB: Pengaturan ── */}
          <TabsContent value="settings" className="mt-4">
            <motion.div variants={fadeUp} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="px-5 py-2.5 bg-black dark:bg-zinc-950 border-b-2 border-black">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pengaturan Payroll</span>
              </div>
              <div className="p-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <SettingItem label="Cut-off Tanggal" value="25 setiap bulan" description="Periode penghitungan gaji dimulai dari tanggal 26 bulan sebelumnya" />
                  <SettingItem label="PTKP" value="TK/0 — Rp 54.000.000/tahun" description="Penghasilan Tidak Kena Pajak untuk karyawan belum menikah" />
                  <SettingItem label="Metode Pembulatan" value="Math.round (standar)" description="Pembulatan ke angka terdekat untuk semua komponen gaji" />
                  <SettingItem label="Formula Version" value="2026.02" description="Versi formula kalkulasi yang digunakan saat ini" />
                </div>
                <div className="mt-4 border-t border-zinc-200 dark:border-zinc-700 pt-4">
                  <p className="text-[10px] font-bold text-zinc-400">Pengaturan lanjutan (konfigurasi per karyawan, PTKP per status pernikahan, custom tunjangan) akan tersedia di update berikutnya.</p>
                </div>
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  )
}

// ── Sub-components ──

function StatusStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div
      className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-colors rounded-none ${
        done
          ? "border border-emerald-400 bg-emerald-50 text-emerald-700"
          : active
            ? "border border-amber-400 bg-amber-50 text-amber-700"
            : "border border-zinc-200 bg-zinc-50 text-zinc-400"
      }`}
    >
      {label}
    </div>
  )
}

function FormulaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className="font-bold text-zinc-900 dark:text-white">{value}</span>
    </div>
  )
}

function InfoItem({ label, value, badge }: { label: string; value: string; badge?: "emerald" | "amber" | "zinc" }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</div>
      {badge ? (
        <span className={`inline-flex items-center gap-1.5 mt-1 text-[9px] font-black uppercase tracking-wide px-2 py-1 border rounded-none ${
          badge === "emerald"
            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
            : badge === "amber"
              ? "bg-amber-50 border-amber-300 text-amber-700"
              : "bg-zinc-50 border-zinc-300 text-zinc-600"
        }`}>
          <span className={`w-1.5 h-1.5 ${
            badge === "emerald" ? "bg-emerald-500" : badge === "amber" ? "bg-amber-500" : "bg-zinc-400"
          }`} />
          {value}
        </span>
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
    <div className="border border-zinc-200 dark:border-zinc-700 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-zinc-900 dark:text-white">{value}</div>
      <div className="mt-1 text-[10px] text-zinc-400">{description}</div>
    </div>
  )
}
