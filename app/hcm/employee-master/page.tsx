"use client"

import * as React from "react"
import { IconPlus, IconSearch, IconFilter, IconDownload, IconEdit, IconTrash } from "@tabler/icons-react"

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

// Mock employee data
const employees = [
  {
    id: "EMP-001",
    nik: "3201012345678901",
    name: "Andi Sutrisno",
    position: "Manager IT",
    department: "Teknologi Informasi",
    status: "Aktif",
    joinDate: "2022-01-15",
    email: "andi.sutrisno@company.com",
    phone: "081234567890",
    npwp: "12.345.678.9-123.000",
    bpjsKesehatan: "0001234567890",
    bpjsKetenagakerjaan: "12345678901234",
    salary: "Rp 15.000.000"
  },
  {
    id: "EMP-002", 
    nik: "3201012345678902",
    name: "Sari Wijaya",
    position: "Finance Manager",
    department: "Keuangan",
    status: "Aktif",
    joinDate: "2021-03-10",
    email: "sari.wijaya@company.com",
    phone: "081234567891",
    npwp: "12.345.678.9-123.001",
    bpjsKesehatan: "0001234567891",
    bpjsKetenagakerjaan: "12345678901235",
    salary: "Rp 18.000.000"
  },
  {
    id: "EMP-003",
    nik: "3201012345678903", 
    name: "Budi Santoso",
    position: "Sales Executive",
    department: "Penjualan",
    status: "Aktif",
    joinDate: "2023-06-01",
    email: "budi.santoso@company.com",
    phone: "081234567892",
    npwp: "12.345.678.9-123.002",
    bpjsKesehatan: "0001234567892",
    bpjsKetenagakerjaan: "12345678901236",
    salary: "Rp 12.000.000"
  },
  {
    id: "EMP-004",
    nik: "3201012345678904",
    name: "Maya Sari",
    position: "HR Specialist",
    department: "SDM",
    status: "Cuti",
    joinDate: "2022-09-15",
    email: "maya.sari@company.com", 
    phone: "081234567893",
    npwp: "12.345.678.9-123.003",
    bpjsKesehatan: "0001234567893",
    bpjsKetenagakerjaan: "12345678901237",
    salary: "Rp 10.000.000"
  },
  {
    id: "EMP-005",
    nik: "3201012345678905",
    name: "Dewi Lestari", 
    position: "Marketing Manager",
    department: "Pemasaran",
    status: "Aktif",
    joinDate: "2020-11-20",
    email: "dewi.lestari@company.com",
    phone: "081234567894",
    npwp: "12.345.678.9-123.004",
    bpjsKesehatan: "0001234567894",
    bpjsKetenagakerjaan: "12345678901238",
    salary: "Rp 16.000.000"
  }
]

export default function EmployeeMasterPage() {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [departmentFilter, setDepartmentFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.nik.includes(searchTerm)
    const matchesDepartment = departmentFilter === "all" || employee.department === departmentFilter
    const matchesStatus = statusFilter === "all" || employee.status === statusFilter
    return matchesSearch && matchesDepartment && matchesStatus
  })

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
              <h1 className="text-lg font-semibold md:text-2xl">Data Master Karyawan</h1>
              <p className="text-sm text-muted-foreground">
                Kelola data karyawan, informasi pribadi, dan detail kepegawaian
              </p>
            </div>
            <Button>
              <IconPlus className="mr-2 h-4 w-4" />
              Tambah Karyawan
            </Button>
          </div>

          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="list">Daftar Karyawan</TabsTrigger>
              <TabsTrigger value="analytics">Analitik SDM</TabsTrigger>
              <TabsTrigger value="reports">Laporan</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4">
              {/* Filters and Search */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Filter & Pencarian</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4 md:flex-row md:items-end">
                    <div className="flex-1">
                      <Label htmlFor="search">Cari Karyawan</Label>
                      <div className="relative">
                        <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="search"
                          placeholder="Nama, NIK, atau ID karyawan..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="min-w-[150px]">
                      <Label>Departemen</Label>
                      <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih departemen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Departemen</SelectItem>
                          <SelectItem value="Teknologi Informasi">Teknologi Informasi</SelectItem>
                          <SelectItem value="Keuangan">Keuangan</SelectItem>
                          <SelectItem value="Penjualan">Penjualan</SelectItem>
                          <SelectItem value="SDM">SDM</SelectItem>
                          <SelectItem value="Pemasaran">Pemasaran</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-[120px]">
                      <Label>Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Status</SelectItem>
                          <SelectItem value="Aktif">Aktif</SelectItem>
                          <SelectItem value="Cuti">Cuti</SelectItem>
                          <SelectItem value="Non-Aktif">Non-Aktif</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="outline">
                      <IconDownload className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Employee Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Daftar Karyawan ({filteredEmployees.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>NIK</TableHead>
                          <TableHead>Nama</TableHead>
                          <TableHead>Posisi</TableHead>
                          <TableHead>Departemen</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Tanggal Masuk</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEmployees.map((employee) => (
                          <TableRow key={employee.id}>
                            <TableCell className="font-medium">{employee.id}</TableCell>
                            <TableCell className="font-mono text-xs">{employee.nik}</TableCell>
                            <TableCell>{employee.name}</TableCell>
                            <TableCell>{employee.position}</TableCell>
                            <TableCell>{employee.department}</TableCell>
                            <TableCell>
                              <Badge variant={employee.status === "Aktif" ? "default" : "secondary"}>
                                {employee.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{employee.joinDate}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm">
                                  <IconEdit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <IconTrash className="h-4 w-4" />
                                </Button>
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

            <TabsContent value="analytics" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Karyawan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{employees.length}</div>
                    <p className="text-xs text-muted-foreground">
                      +2 dari bulan lalu
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Karyawan Aktif</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {employees.filter(e => e.status === "Aktif").length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      96% dari total karyawan
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Departemen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">5</div>
                    <p className="text-xs text-muted-foreground">
                      Departemen aktif
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Rata-rata Gaji</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">Rp 14.2M</div>
                    <p className="text-xs text-muted-foreground">
                      Per bulan
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="reports" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Laporan Kepegawaian</CardTitle>
                  <CardDescription>
                    Generate laporan data karyawan untuk keperluan administrasi
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Laporan BPJS</span>
                      <span className="text-sm text-muted-foreground">Data kepesertaan BPJS</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Laporan Pajak</span>
                      <span className="text-sm text-muted-foreground">Data NPWP dan PPh21</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Daftar Karyawan</span>
                      <span className="text-sm text-muted-foreground">Data lengkap karyawan</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Organisasi</span>
                      <span className="text-sm text-muted-foreground">Struktur organisasi</span>
                    </Button>
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