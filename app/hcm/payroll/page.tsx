"use client"

import * as React from "react"
import { IconCalculator, IconDownload, IconEye, IconCheck, IconClock } from "@tabler/icons-react"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock payroll data
const payrollData = [
  {
    employeeId: "EMP-001",
    name: "Andi Sutrisno",
    position: "Manager IT",
    basicSalary: 15000000,
    allowances: {
      transport: 1000000,
      meal: 500000,
      position: 2000000
    },
    overtime: 800000,
    bpjsKesehatan: 150000,
    bpjsKetenagakerjaan: 300000,
    pph21: 1250000,
    netSalary: 17600000,
    status: "Approved"
  },
  {
    employeeId: "EMP-002",
    name: "Sari Wijaya", 
    position: "Finance Manager",
    basicSalary: 18000000,
    allowances: {
      transport: 1000000,
      meal: 500000,
      position: 2500000
    },
    overtime: 0,
    bpjsKesehatan: 180000,
    bpjsKetenagakerjaan: 360000,
    pph21: 1650000,
    netSalary: 19810000,
    status: "Pending"
  },
  {
    employeeId: "EMP-003",
    name: "Budi Santoso",
    position: "Sales Executive", 
    basicSalary: 12000000,
    allowances: {
      transport: 800000,
      meal: 500000,
      position: 1000000
    },
    overtime: 600000,
    bpjsKesehatan: 120000,
    bpjsKetenagakerjaan: 240000,
    pph21: 850000,
    netSalary: 13790000,
    status: "Draft"
  },
  {
    employeeId: "EMP-004",
    name: "Maya Sari",
    position: "HR Specialist",
    basicSalary: 10000000,
    allowances: {
      transport: 800000,
      meal: 500000,
      position: 800000
    },
    overtime: 400000,
    bpjsKesehatan: 100000,
    bpjsKetenagakerjaan: 200000,
    pph21: 620000,
    netSalary: 11780000,
    status: "Approved"
  }
]

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount)
}

export default function PayrollPage() {
  const [selectedPeriod, setSelectedPeriod] = React.useState("2024-11")
  
  const totalGrossSalary = payrollData.reduce((sum, emp) => 
    sum + emp.basicSalary + emp.allowances.transport + emp.allowances.meal + emp.allowances.position + emp.overtime, 0
  )
  
  const totalDeductions = payrollData.reduce((sum, emp) => 
    sum + emp.bpjsKesehatan + emp.bpjsKetenagakerjaan + emp.pph21, 0
  )
  
  const totalNetSalary = payrollData.reduce((sum, emp) => sum + emp.netSalary, 0)

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold md:text-2xl">Pemrosesan Payroll</h1>
              <p className="text-sm text-muted-foreground">
                Kelola penggajian bulanan, perhitungan pajak, dan BPJS
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <IconDownload className="mr-2 h-4 w-4" />
                Export Payroll
              </Button>
              <Button>
                <IconCalculator className="mr-2 h-4 w-4" />
                Hitung Payroll
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
              {/* Period Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Periode Payroll</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div>
                      <Label>Pilih Periode</Label>
                      <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2024-11">November 2024</SelectItem>
                          <SelectItem value="2024-10">Oktober 2024</SelectItem>
                          <SelectItem value="2024-09">September 2024</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <Button variant="outline" size="sm">Lihat Detail</Button>
                      <Button variant="outline" size="sm">Proses Ulang</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Gaji Kotor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalGrossSalary)}</div>
                    <p className="text-xs text-muted-foreground">
                      {payrollData.length} karyawan
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Potongan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalDeductions)}</div>
                    <p className="text-xs text-muted-foreground">
                      BPJS + PPh21
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Gaji Bersih</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalNetSalary)}</div>
                    <p className="text-xs text-muted-foreground">
                      Siap dibayarkan
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {payrollData.filter(p => p.status === "Pending").length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Menunggu approval
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Payroll Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detail Payroll November 2024</CardTitle>
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
                          <TableHead>Status</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollData.map((payroll) => (
                          <TableRow key={payroll.employeeId}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{payroll.name}</div>
                                <div className="text-sm text-muted-foreground">{payroll.employeeId}</div>
                              </div>
                            </TableCell>
                            <TableCell>{formatCurrency(payroll.basicSalary)}</TableCell>
                            <TableCell>
                              {formatCurrency(
                                payroll.allowances.transport + 
                                payroll.allowances.meal + 
                                payroll.allowances.position
                              )}
                            </TableCell>
                            <TableCell>{formatCurrency(payroll.overtime)}</TableCell>
                            <TableCell>
                              {formatCurrency(payroll.bpjsKesehatan + payroll.bpjsKetenagakerjaan)}
                            </TableCell>
                            <TableCell>{formatCurrency(payroll.pph21)}</TableCell>
                            <TableCell className="font-semibold">
                              {formatCurrency(payroll.netSalary)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                payroll.status === "Approved" ? "default" :
                                payroll.status === "Pending" ? "secondary" : "outline"
                              }>
                                {payroll.status === "Approved" ? "Disetujui" :
                                 payroll.status === "Pending" ? "Pending" : "Draft"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm">
                                  <IconEye className="h-4 w-4" />
                                </Button>
                                {payroll.status === "Pending" && (
                                  <Button variant="ghost" size="sm">
                                    <IconCheck className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calculation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Kalkulasi Payroll</CardTitle>
                  <CardDescription>
                    Pengaturan perhitungan gaji, tunjangan, dan potongan
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">BPJS Kesehatan</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-2">Tarif: 1% dari gaji pokok</p>
                        <p className="text-sm">Maksimal: Rp 150,000/bulan</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">BPJS Ketenagakerjaan</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-2">Tarif: 2% dari gaji pokok</p>
                        <p className="text-sm">Maksimal: Rp 360,000/bulan</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">PPh21</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-2">Tarif progresif</p>
                        <p className="text-sm">Sesuai UU No. 7 Tahun 2021</p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Laporan Payroll</CardTitle>
                  <CardDescription>
                    Generate berbagai laporan terkait penggajian
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Slip Gaji</span>
                      <span className="text-sm text-muted-foreground">Individual per karyawan</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Rekapitulasi Payroll</span>
                      <span className="text-sm text-muted-foreground">Summary bulanan</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Laporan BPJS</span>
                      <span className="text-sm text-muted-foreground">Data iuran BPJS</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">SPT Masa PPh21</span>
                      <span className="text-sm text-muted-foreground">Laporan pajak bulanan</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pengaturan Payroll</CardTitle>
                  <CardDescription>
                    Konfigurasi sistem penggajian
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Tanggal Cut Off</Label>
                      <Input type="number" defaultValue="25" />
                      <p className="text-sm text-muted-foreground mt-1">
                        Tanggal potong untuk perhitungan gaji
                      </p>
                    </div>
                    <div>
                      <Label>Tanggal Pembayaran</Label>
                      <Input type="number" defaultValue="30" />
                      <p className="text-sm text-muted-foreground mt-1">
                        Tanggal pembayaran gaji
                      </p>
                    </div>
                    <div>
                      <Label>PTKP Default</Label>
                      <Select defaultValue="TK0">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TK0">TK/0 - Rp 54,000,000</SelectItem>
                          <SelectItem value="TK1">TK/1 - Rp 58,500,000</SelectItem>
                          <SelectItem value="TK2">TK/2 - Rp 63,000,000</SelectItem>
                          <SelectItem value="K0">K/0 - Rp 58,500,000</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Metode Pembulatan</Label>
                      <Select defaultValue="nearest">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nearest">Pembulatan Terdekat</SelectItem>
                          <SelectItem value="up">Pembulatan Ke Atas</SelectItem>
                          <SelectItem value="down">Pembulatan Ke Bawah</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}