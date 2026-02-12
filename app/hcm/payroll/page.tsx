"use client"

import * as React from "react"
import { IconCalculator, IconDownload, IconCheck, IconRefresh } from "@tabler/icons-react"
import * as XLSX from "xlsx"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { approvePayrollRun, createPayrollDisbursementBatch, generatePayrollDraft, getPayrollComplianceReport, getPayrollExportData, getPayrollRun } from "@/app/actions/hcm"
import { toast } from "sonner"

interface PayrollLine {
  employeeId: string
  employeeCode: string
  employeeName: string
  department: string
  position: string
  attendanceDays: number
  leaveDays: number
  lateCount: number
  overtimeHours: number
  basicSalary: number
  transportAllowance: number
  mealAllowance: number
  positionAllowance: number
  overtimePay: number
  bpjsKesehatan: number
  bpjsKetenagakerjaan: number
  pph21: number
  grossSalary: number
  totalDeductions: number
  netSalary: number
}

interface PayrollRunData {
  period: string
  periodLabel: string
  status: "PENDING_APPROVAL" | "POSTED"
  generatedAt: string
  generatedBy: string
  postedAt: string | null
  postedBy: string | null
  postedJournalReference: string | null
  disbursementStatus?: "PENDING" | "PAID" | null
  disbursedAt?: string | null
  disbursementReference?: string | null
  disbursementMethod?: string | null
  approverName: string
  summary: {
    gross: number
    deductions: number
    net: number
    employees: number
    overtimeHours: number
  }
  lines: PayrollLine[]
}

interface PayrollComplianceReport {
  period: string
  periodLabel: string
  employeeCount: number
  totals: {
    bpjsKesehatan: number
    bpjsKetenagakerjaan: number
    bpjsTotal: number
    pph21: number
  }
  rows?: Array<{
    employeeCode: string
    employeeName: string
    department: string
    bpjsKesehatan: number
    bpjsKetenagakerjaan: number
    pph21: number
    netSalary: number
  }>
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount)
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
  const [selectedPeriod, setSelectedPeriod] = React.useState(currentPeriod())
  const [run, setRun] = React.useState<PayrollRunData | null>(null)
  const [compliance, setCompliance] = React.useState<PayrollComplianceReport | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [processing, setProcessing] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)

  const periodOptions = React.useMemo(() => buildPeriodOptions(), [])

  const loadRun = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await getPayrollRun(selectedPeriod)
      if (!result.success) {
        toast.error("error" in result ? String(result.error) : "Gagal memuat payroll")
        setRun(null)
        return
      }

      if ("exists" in result && !result.exists) {
        setRun(null)
        return
      }

      if ("run" in result) {
        setRun(result.run as PayrollRunData)
      } else {
        setRun(null)
      }
    } catch {
      toast.error("Terjadi kesalahan saat memuat payroll")
      setRun(null)
    } finally {
      setLoading(false)
    }
  }, [selectedPeriod])

  React.useEffect(() => {
    loadRun()
  }, [loadRun])

  const loadCompliance = React.useCallback(async () => {
    const result = await getPayrollComplianceReport(selectedPeriod)
    if (!result.success || !("report" in result) || !result.report) {
      setCompliance(null)
      return
    }
    setCompliance(result.report as PayrollComplianceReport)
  }, [selectedPeriod])

  React.useEffect(() => {
    loadCompliance()
  }, [loadCompliance])

  const handleGenerate = async () => {
    setProcessing(true)
    try {
      const result = await generatePayrollDraft(selectedPeriod)
      if (!result.success) {
        toast.error("error" in result ? String(result.error) : "Gagal menghitung payroll")
        return
      }

      toast.success("message" in result ? result.message : "Payroll draft berhasil dihitung")
      await loadRun()
      await loadCompliance()
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
      await loadRun()
      await loadCompliance()
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
      await loadRun()
      await loadCompliance()
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

    const headers = ["Kode", "Nama", "Departemen", "BPJS Kesehatan", "BPJS Ketenagakerjaan", "PPh21", "Gaji Bersih"]
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.employeeCode,
          row.employeeName,
          row.department,
          row.bpjsKesehatan,
          row.bpjsKetenagakerjaan,
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
      rows.map((row) => ({
        Kode: row.employeeCode,
        Nama: row.employeeName,
        Departemen: row.department,
        BPJSKesehatan: row.bpjsKesehatan,
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

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl">Pemrosesan Payroll</h1>
          <p className="text-sm text-muted-foreground">Generate draft payroll, approval manager/boss, lalu post otomatis ke jurnal keuangan.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={exporting}>
            <IconDownload className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handleExportXLS} disabled={exporting}>
            <IconDownload className="mr-2 h-4 w-4" />
            Export XLS
          </Button>
          <Button variant="outline" onClick={handleOpenPayrollPDF} disabled={!run || loading}>
            <IconDownload className="mr-2 h-4 w-4" />
            PDF Payroll
          </Button>
          <Button variant="outline" onClick={loadRun} disabled={loading || processing}>
            <IconRefresh className="mr-2 h-4 w-4" />
            Muat Ulang
          </Button>
          <Button onClick={handleGenerate} disabled={processing}>
            <IconCalculator className="mr-2 h-4 w-4" />
            {processing ? "Memproses..." : "Hitung Payroll"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="current">Payroll Berjalan</TabsTrigger>
          <TabsTrigger value="calculation">Perhitungan</TabsTrigger>
          <TabsTrigger value="reports">Laporan</TabsTrigger>
          <TabsTrigger value="settings">Pengaturan</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Periode Payroll</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div>
                  <Label>Pilih Periode</Label>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger className="w-[240px]">
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
                <div className="flex items-end gap-2">
                  {run ? (
                    <Badge variant={run.status === "POSTED" ? "default" : "secondary"}>
                      {run.status === "POSTED" ? "POSTED" : "PENDING APPROVAL"}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Belum ada draft</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Gaji Kotor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalGrossSalary)}</div>
                <p className="text-xs text-muted-foreground">{employeeCount} karyawan</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Potongan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalDeductions)}</div>
                <p className="text-xs text-muted-foreground">BPJS + PPh21</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Gaji Bersih</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalNetSalary)}</div>
                <p className="text-xs text-muted-foreground">Siap dibayarkan</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{run ? (run.status === "POSTED" ? 0 : employeeCount) : 0}</div>
                <p className="text-xs text-muted-foreground">{run?.status === "POSTED" ? "Sudah diposting" : "Menunggu approval"}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Detail Payroll {run?.periodLabel || "-"}</CardTitle>
              {run?.status !== "POSTED" && run ? (
                <Button onClick={handleApprove} disabled={processing}>
                  <IconCheck className="mr-2 h-4 w-4" />
                  Approve & Post Jurnal
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Gaji Pokok</TableHead>
                      <TableHead>Tunjangan</TableHead>
                      <TableHead>Lembur</TableHead>
                      <TableHead>BPJS</TableHead>
                      <TableHead>PPh21</TableHead>
                      <TableHead>Gaji Bersih</TableHead>
                      <TableHead className="text-right">Slip Gaji</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">Memuat data payroll...</TableCell>
                      </TableRow>
                    ) : !run || run.lines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Belum ada payroll draft untuk periode ini. Klik "Hitung Payroll".
                        </TableCell>
                      </TableRow>
                    ) : (
                      run.lines.map((line) => (
                        <TableRow key={line.employeeId}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{line.employeeName}</div>
                              <div className="text-sm text-muted-foreground">{line.employeeCode} • {line.department}</div>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(line.basicSalary)}</TableCell>
                          <TableCell>{formatCurrency(line.transportAllowance + line.mealAllowance + line.positionAllowance)}</TableCell>
                          <TableCell>{formatCurrency(line.overtimePay)}</TableCell>
                          <TableCell>{formatCurrency(line.bpjsKesehatan + line.bpjsKetenagakerjaan)}</TableCell>
                          <TableCell>{formatCurrency(line.pph21)}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(line.netSalary)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenPayslipPDF(line)}
                            >
                              <IconDownload className="mr-2 h-4 w-4" />
                              PDF
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Formula Payroll Aktif</CardTitle>
              <CardDescription>Formula ini digunakan otomatis saat tombol "Hitung Payroll" dijalankan.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tunjangan</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>Transport: 7% gaji pokok</p>
                  <p>Makan: 3% gaji pokok</p>
                  <p>Posisi: 10% gaji pokok</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">BPJS</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>Kesehatan: 1% (maks Rp 150.000)</p>
                  <p>Ketenagakerjaan: 2% (maks Rp 360.000)</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">PPh21</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>5% dari penghasilan kena pajak bulanan</p>
                  <p>(gross - BPJS)</p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Laporan Payroll</CardTitle>
              <CardDescription>Status posting payroll ke jurnal keuangan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!run ? (
                <p className="text-muted-foreground">Belum ada payroll run untuk periode ini.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleOpenPayrollPDF}>
                      <IconDownload className="mr-2 h-4 w-4" />
                      Unduh PDF Payroll
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportXLS} disabled={exporting}>
                      <IconDownload className="mr-2 h-4 w-4" />
                      Unduh XLS
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={exporting}>
                      <IconDownload className="mr-2 h-4 w-4" />
                      Unduh CSV
                    </Button>
                  </div>
                  <p>
                    <span className="font-medium">Periode:</span> {run.periodLabel}
                  </p>
                  <p>
                    <span className="font-medium">Generated:</span>{" "}
                    {new Date(run.generatedAt).toLocaleString("id-ID")}
                  </p>
                  <p>
                    <span className="font-medium">Approver:</span> {run.approverName}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span> {run.status}
                  </p>
                  <p>
                    <span className="font-medium">Jurnal Reference:</span> {run.postedJournalReference || "-"}
                  </p>
                  <p>
                    <span className="font-medium">Disbursement:</span> {run.disbursementStatus || "PENDING"}
                  </p>
                  <p>
                    <span className="font-medium">Disbursement Ref:</span> {run.disbursementReference || "-"}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleCreateDisbursement}
                      disabled={processing || run.disbursementStatus === "PAID" || run.status !== "POSTED"}
                    >
                      {run.disbursementStatus === "PAID" ? "Sudah Disburse" : "Buat Batch Disbursement"}
                    </Button>
                  </div>
                  {compliance ? (
                    <div className="rounded-md border border-zinc-200 p-3">
                      <p className="font-medium">Ringkasan Compliance Payroll</p>
                      <p>BPJS Kesehatan: {formatCurrency(compliance.totals.bpjsKesehatan)}</p>
                      <p>BPJS Ketenagakerjaan: {formatCurrency(compliance.totals.bpjsKetenagakerjaan)}</p>
                      <p>Total BPJS: {formatCurrency(compliance.totals.bpjsTotal)}</p>
                      <p>PPh21: {formatCurrency(compliance.totals.pph21)}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportComplianceCSV}>
                          <IconDownload className="mr-2 h-4 w-4" />
                          Export Compliance CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportComplianceXLS}>
                          <IconDownload className="mr-2 h-4 w-4" />
                          Export Compliance XLS
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Payroll</CardTitle>
              <CardDescription>
                Pengaturan payroll lanjutan (cut-off, metode pembulatan, PTKP) akan dipusatkan di fase berikutnya.
              </CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
