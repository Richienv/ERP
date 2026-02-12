"use client"

import * as React from "react"
import { IconPlus, IconSearch, IconDownload, IconEdit, IconTrash } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createEmployee, deactivateEmployee, getEmployees, updateEmployee } from "@/app/actions/hcm"
import { toast } from "sonner"

interface EmployeeRow {
  id: string
  employeeCode: string
  name: string
  firstName: string
  lastName?: string | null
  email?: string | null
  phone?: string | null
  department: string
  position: string
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED"
  joinDate: string
  baseSalary: number
}

const EMPTY_FORM = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  department: "",
  position: "",
  joinDate: "",
  status: "ACTIVE" as EmployeeRow["status"],
  baseSalary: "",
}

export default function EmployeeMasterPage() {
  const [employees, setEmployees] = React.useState<EmployeeRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)

  const [searchTerm, setSearchTerm] = React.useState("")
  const [departmentFilter, setDepartmentFilter] = React.useState("all")
  const [statusFilter, setStatusFilter] = React.useState("all")

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<EmployeeRow | null>(null)
  const [form, setForm] = React.useState(EMPTY_FORM)

  const loadEmployees = React.useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getEmployees({ includeInactive: true })
      setEmployees(rows as EmployeeRow[])
    } catch {
      toast.error("Gagal memuat data karyawan")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const departments = React.useMemo(
    () => Array.from(new Set(employees.map((employee) => employee.department))).sort((a, b) => a.localeCompare(b)),
    [employees]
  )

  const filteredEmployees = React.useMemo(() => {
    return employees.filter((employee) => {
      const keyword = searchTerm.toLowerCase()
      const matchesSearch =
        employee.name.toLowerCase().includes(keyword) ||
        employee.employeeCode.toLowerCase().includes(keyword) ||
        (employee.email || "").toLowerCase().includes(keyword)

      const matchesDepartment = departmentFilter === "all" || employee.department === departmentFilter
      const matchesStatus = statusFilter === "all" || employee.status === statusFilter

      return matchesSearch && matchesDepartment && matchesStatus
    })
  }, [employees, searchTerm, departmentFilter, statusFilter])

  const openCreateDialog = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, joinDate: new Date().toISOString().slice(0, 10) })
    setDialogOpen(true)
  }

  const openEditDialog = (employee: EmployeeRow) => {
    setEditing(employee)
    setForm({
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName || "",
      email: employee.email || "",
      phone: employee.phone || "",
      department: employee.department,
      position: employee.position,
      joinDate: employee.joinDate,
      status: employee.status,
      baseSalary: employee.baseSalary ? String(employee.baseSalary) : "",
    })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.department.trim() || !form.position.trim() || !form.joinDate) {
      toast.error("Nama, departemen, posisi, dan tanggal masuk wajib diisi")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        employeeCode: editing ? undefined : form.employeeCode,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        department: form.department,
        position: form.position,
        joinDate: form.joinDate,
        status: form.status,
        baseSalary: form.baseSalary ? Number(form.baseSalary) : 0,
      }

      const result = editing
        ? await updateEmployee(editing.id, payload)
        : await createEmployee(payload)

      if (!result.success) {
        toast.error("error" in result ? String(result.error) : "Gagal menyimpan karyawan")
        return
      }

      toast.success(editing ? "Data karyawan berhasil diperbarui" : "Karyawan berhasil ditambahkan")
      setDialogOpen(false)
      await loadEmployees()
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan data")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (employee: EmployeeRow) => {
    const confirmDeactivate = window.confirm(`Nonaktifkan ${employee.name}?`)
    if (!confirmDeactivate) return

    const result = await deactivateEmployee(employee.id)
    if (!result.success) {
      toast.error("error" in result ? String(result.error) : "Gagal menonaktifkan karyawan")
      return
    }

    toast.success("Karyawan berhasil dinonaktifkan")
    await loadEmployees()
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl">Data Master Karyawan</h1>
          <p className="text-sm text-muted-foreground">
            Kelola data karyawan, informasi pribadi, dan detail kepegawaian.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
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
                      placeholder="Nama, kode karyawan, email..."
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="min-w-[180px]">
                  <Label>Departemen</Label>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih departemen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Departemen</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department} value={department}>
                          {department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[160px]">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="ACTIVE">Aktif</SelectItem>
                      <SelectItem value="ON_LEAVE">Sedang Cuti</SelectItem>
                      <SelectItem value="INACTIVE">Non-Aktif</SelectItem>
                      <SelectItem value="TERMINATED">Terminasi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={loadEmployees}>
                  <IconDownload className="mr-2 h-4 w-4" />
                  Muat Ulang
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daftar Karyawan ({filteredEmployees.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Posisi</TableHead>
                      <TableHead>Departemen</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal Masuk</TableHead>
                      <TableHead>Gaji Pokok</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Memuat data karyawan...
                        </TableCell>
                      </TableRow>
                    ) : filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          Data karyawan tidak ditemukan.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.employeeCode}</TableCell>
                          <TableCell>{employee.name}</TableCell>
                          <TableCell>{employee.position}</TableCell>
                          <TableCell>{employee.department}</TableCell>
                          <TableCell>
                            <Badge
                              variant={employee.status === "ACTIVE" ? "default" : "secondary"}
                              className={employee.status === "ON_LEAVE" ? "bg-amber-100 text-amber-800" : ""}
                            >
                              {employee.status === "ACTIVE"
                                ? "Aktif"
                                : employee.status === "ON_LEAVE"
                                  ? "Cuti"
                                  : employee.status === "INACTIVE"
                                    ? "Non-Aktif"
                                    : "Terminasi"}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(employee.joinDate).toLocaleDateString("id-ID")}</TableCell>
                          <TableCell>
                            {new Intl.NumberFormat("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              maximumFractionDigits: 0,
                            }).format(employee.baseSalary || 0)}
                          </TableCell>
                          <TableCell>{employee.email || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(employee)}>
                                <IconEdit className="h-4 w-4" />
                              </Button>
                              {employee.status !== "INACTIVE" && employee.status !== "TERMINATED" ? (
                                <Button variant="ghost" size="sm" onClick={() => handleDeactivate(employee)}>
                                  <IconTrash className="h-4 w-4 text-red-600" />
                                </Button>
                              ) : null}
                            </div>
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

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Karyawan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employees.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Karyawan Aktif</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employees.filter((employee) => employee.status === "ACTIVE").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Sedang Cuti</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{employees.filter((employee) => employee.status === "ON_LEAVE").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Departemen Aktif</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{departments.length}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Laporan Kepegawaian</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Data SDM kini bersumber dari database Employee, Attendance, dan LeaveRequest.</p>
              <p>Gunakan filter daftar karyawan untuk mengekspor segmen data sesuai kebutuhan.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Karyawan" : "Tambah Karyawan"}</DialogTitle>
            <DialogDescription>
              Lengkapi informasi master karyawan. Data ini dipakai oleh SDM, Pengadaan, Gudang, dan modul approval.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            {!editing ? (
              <div className="grid gap-2">
                <Label>Kode Karyawan (Opsional)</Label>
                <Input
                  value={form.employeeCode}
                  onChange={(event) => setForm((prev) => ({ ...prev, employeeCode: event.target.value }))}
                  placeholder="Contoh: EMP-2026-001"
                />
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label>Nama Depan</Label>
              <Input value={form.firstName} onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Nama Belakang</Label>
              <Input value={form.lastName} onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Telepon</Label>
              <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Departemen</Label>
              <Input value={form.department} onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))} placeholder="Contoh: Produksi" />
            </div>
            <div className="grid gap-2">
              <Label>Posisi</Label>
              <Input value={form.position} onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))} placeholder="Contoh: Supervisor Produksi" />
            </div>
            <div className="grid gap-2">
              <Label>Tanggal Masuk</Label>
              <Input type="date" value={form.joinDate} onChange={(event) => setForm((prev) => ({ ...prev, joinDate: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as EmployeeRow["status"] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Aktif</SelectItem>
                  <SelectItem value="ON_LEAVE">Sedang Cuti</SelectItem>
                  <SelectItem value="INACTIVE">Non-Aktif</SelectItem>
                  <SelectItem value="TERMINATED">Terminasi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Gaji Pokok</Label>
              <Input
                type="number"
                min={0}
                value={form.baseSalary}
                onChange={(event) => setForm((prev) => ({ ...prev, baseSalary: event.target.value }))}
                placeholder="Contoh: 7500000"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambah Karyawan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
