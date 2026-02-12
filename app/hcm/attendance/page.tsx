"use client"

import * as React from "react"
import { IconClock, IconCalendar, IconUser, IconTrendingUp, IconAlertTriangle, IconRefresh } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  approveLeaveRequest,
  getAttendanceSnapshot,
  getEmployees,
  getLeaveRequests,
  recordAttendanceEvent,
  rejectLeaveRequest,
  submitLeaveRequest,
} from "@/app/actions/hcm"
import { toast } from "sonner"

interface AttendanceRow {
  id: string
  employeeCode: string
  name: string
  department: string
  position: string
  clockIn: string
  clockOut: string
  workingHours: number
  overtimeHours: number
  status: "PRESENT" | "ABSENT" | "LEAVE" | "SICK" | "REMOTE"
  isLate: boolean
}

interface LeaveRow {
  id: string
  employeeId: string
  employeeName: string
  department: string
  startDate: string
  endDate: string
  type: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  reason?: string | null
  approverName?: string
}

interface EmployeeOption {
  id: string
  employeeCode: string
  name: string
  department: string
}

const getStatusBadge = (status: AttendanceRow["status"], isLate: boolean) => {
  if (status === "LEAVE") return <Badge variant="secondary">Cuti</Badge>
  if (status === "SICK") return <Badge variant="secondary">Sakit</Badge>
  if (status === "REMOTE") return <Badge variant="outline">Remote</Badge>
  if (status === "PRESENT" && isLate) return <Badge variant="destructive">Terlambat</Badge>
  if (status === "PRESENT") return <Badge variant="default">Hadir</Badge>
  return <Badge variant="outline">Absen</Badge>
}

const todayInput = () => new Date().toISOString().slice(0, 10)

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = React.useState(todayInput())
  const [selectedDepartment, setSelectedDepartment] = React.useState("all")

  const [rows, setRows] = React.useState<AttendanceRow[]>([])
  const [departments, setDepartments] = React.useState<string[]>([])
  const [stats, setStats] = React.useState({
    totalEmployees: 0,
    presentCount: 0,
    lateCount: 0,
    leaveCount: 0,
    absentCount: 0,
    attendanceRate: 0,
  })

  const [employees, setEmployees] = React.useState<EmployeeOption[]>([])
  const [leaveRequests, setLeaveRequests] = React.useState<LeaveRow[]>([])

  const [loadingToday, setLoadingToday] = React.useState(true)
  const [loadingLeaves, setLoadingLeaves] = React.useState(false)

  const [clockDialogOpen, setClockDialogOpen] = React.useState(false)
  const [clockForm, setClockForm] = React.useState({ employeeId: "", mode: "CLOCK_IN" as "CLOCK_IN" | "CLOCK_OUT" })
  const [clockSubmitting, setClockSubmitting] = React.useState(false)

  const [leaveSubmitting, setLeaveSubmitting] = React.useState(false)
  const [leaveForm, setLeaveForm] = React.useState({
    employeeId: "",
    type: "ANNUAL",
    startDate: todayInput(),
    endDate: todayInput(),
    reason: "",
  })

  const loadToday = React.useCallback(async () => {
    setLoadingToday(true)
    try {
      const snapshot = await getAttendanceSnapshot({
        date: selectedDate,
        department: selectedDepartment,
      })

      setRows(snapshot.rows as AttendanceRow[])
      setDepartments(snapshot.departments || [])
      setStats(snapshot.stats)
    } catch {
      toast.error("Gagal memuat data absensi")
    } finally {
      setLoadingToday(false)
    }
  }, [selectedDate, selectedDepartment])

  const loadEmployees = React.useCallback(async () => {
    const list = await getEmployees({ includeInactive: false })
    setEmployees((list as EmployeeOption[]).filter((employee) => employee.id))
  }, [])

  const loadLeaves = React.useCallback(async () => {
    setLoadingLeaves(true)
    try {
      const list = await getLeaveRequests({ status: "ALL", limit: 30 })
      setLeaveRequests(list as LeaveRow[])
    } catch {
      toast.error("Gagal memuat daftar cuti")
    } finally {
      setLoadingLeaves(false)
    }
  }, [])

  React.useEffect(() => {
    loadToday()
  }, [loadToday])

  React.useEffect(() => {
    loadEmployees()
    loadLeaves()
  }, [loadEmployees, loadLeaves])

  const overtimeRows = React.useMemo(() => {
    return rows.filter((row) => row.overtimeHours > 0).sort((a, b) => b.overtimeHours - a.overtimeHours)
  }, [rows])

  const pendingLeaveRows = React.useMemo(() => leaveRequests.filter((item) => item.status === "PENDING"), [leaveRequests])

  const handleClockSubmit = async () => {
    if (!clockForm.employeeId) {
      toast.error("Pilih karyawan terlebih dahulu")
      return
    }

    setClockSubmitting(true)
    try {
      const result = await recordAttendanceEvent({
        employeeId: clockForm.employeeId,
        mode: clockForm.mode,
      })

      if (!result.success) {
        toast.error("error" in result ? String(result.error) : "Gagal mencatat absensi")
        return
      }

      toast.success("message" in result ? result.message : "Absensi berhasil dicatat")
      setClockDialogOpen(false)
      setClockForm({ employeeId: "", mode: "CLOCK_IN" })
      await loadToday()
    } catch {
      toast.error("Terjadi kesalahan saat mencatat absensi")
    } finally {
      setClockSubmitting(false)
    }
  }

  const handleSubmitLeave = async () => {
    if (!leaveForm.employeeId || !leaveForm.startDate || !leaveForm.endDate) {
      toast.error("Lengkapi karyawan, tanggal mulai, dan tanggal selesai")
      return
    }

    setLeaveSubmitting(true)
    try {
      const result = await submitLeaveRequest({
        employeeId: leaveForm.employeeId,
        type: leaveForm.type,
        startDate: leaveForm.startDate,
        endDate: leaveForm.endDate,
        reason: leaveForm.reason,
      })

      if (!result.success) {
        toast.error("error" in result ? String(result.error) : "Gagal membuat pengajuan cuti")
        return
      }

      toast.success("Pengajuan cuti berhasil dibuat")
      setLeaveForm({
        employeeId: "",
        type: "ANNUAL",
        startDate: todayInput(),
        endDate: todayInput(),
        reason: "",
      })
      await loadLeaves()
    } catch {
      toast.error("Terjadi kesalahan saat membuat pengajuan cuti")
    } finally {
      setLeaveSubmitting(false)
    }
  }

  const handleApproveLeave = async (leaveId: string) => {
    const result = await approveLeaveRequest(leaveId)
    if (!result.success) {
      toast.error("error" in result ? String(result.error) : "Gagal menyetujui cuti")
      return
    }
    toast.success("message" in result ? result.message : "Pengajuan cuti disetujui")
    await Promise.all([loadLeaves(), loadToday()])
  }

  const handleRejectLeave = async (leaveId: string) => {
    const result = await rejectLeaveRequest(leaveId, "Ditolak dari modul Absensi")
    if (!result.success) {
      toast.error("error" in result ? String(result.error) : "Gagal menolak cuti")
      return
    }
    toast.success("message" in result ? result.message : "Pengajuan cuti ditolak")
    await Promise.all([loadLeaves(), loadToday()])
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl">Pelacakan Absensi</h1>
          <p className="text-sm text-muted-foreground">Monitor kehadiran karyawan, jam kerja, lembur, dan cuti.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => loadToday()} disabled={loadingToday}>
            <IconRefresh className="mr-2 h-4 w-4" />
            Muat Ulang
          </Button>
          <Button variant="outline">
            <IconCalendar className="mr-2 h-4 w-4" />
            Atur Jadwal
          </Button>
          <Button onClick={() => setClockDialogOpen(true)}>
            <IconClock className="mr-2 h-4 w-4" />
            Clock In/Out
          </Button>
        </div>
      </div>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="today">Hari Ini</TabsTrigger>
          <TabsTrigger value="monthly">Laporan Bulanan</TabsTrigger>
          <TabsTrigger value="overtime">Lembur</TabsTrigger>
          <TabsTrigger value="leave">Cuti & Izin</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filter Absensi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
                <div>
                  <Label>Tanggal</Label>
                  <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="w-[200px]" />
                </div>
                <div>
                  <Label>Departemen</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
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
                <Button variant="outline" onClick={() => loadToday()}>
                  Terapkan Filter
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hadir Hari Ini</CardTitle>
                <IconUser className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.presentCount}</div>
                <p className="text-xs text-muted-foreground">dari {stats.totalEmployees} karyawan</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Terlambat</CardTitle>
                <IconAlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.lateCount}</div>
                <p className="text-xs text-muted-foreground">Karyawan telat clock-in</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tidak Hadir</CardTitle>
                <IconUser className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.absentCount}</div>
                <p className="text-xs text-muted-foreground">Absen tanpa catatan</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tingkat Kehadiran</CardTitle>
                <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.attendanceRate}%</div>
                <p className="text-xs text-muted-foreground">Termasuk status cuti</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Absensi - {new Date(selectedDate).toLocaleDateString("id-ID")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Masuk</TableHead>
                      <TableHead>Keluar</TableHead>
                      <TableHead>Jam Kerja</TableHead>
                      <TableHead>Lembur</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingToday ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Memuat data absensi...
                        </TableCell>
                      </TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Tidak ada data absensi pada filter ini.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((attendance) => (
                        <TableRow key={attendance.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{attendance.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {attendance.employeeCode} • {attendance.department}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{attendance.clockIn}</TableCell>
                          <TableCell className="font-mono">{attendance.clockOut}</TableCell>
                          <TableCell>{attendance.workingHours.toFixed(2)} jam</TableCell>
                          <TableCell>{attendance.overtimeHours.toFixed(2)} jam</TableCell>
                          <TableCell>{getStatusBadge(attendance.status, attendance.isLate)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Laporan Bulanan</CardTitle>
              <CardDescription>Ringkasan metrik kehadiran berdasarkan filter tanggal aktif.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Rata-rata Jam Kerja</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {rows.length > 0
                      ? (rows.reduce((sum, row) => sum + row.workingHours, 0) / rows.length).toFixed(2)
                      : "0.00"}{" "}
                    jam
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Total Lembur</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{rows.reduce((sum, row) => sum + row.overtimeHours, 0).toFixed(2)} jam</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ketepatan Waktu</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalEmployees > 0
                      ? Math.round(((stats.presentCount - stats.lateCount) / stats.totalEmployees) * 100)
                      : 0}
                    %
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overtime" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manajemen Lembur</CardTitle>
              <CardDescription>Daftar lembur dari data absensi tanggal terpilih.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Departemen</TableHead>
                      <TableHead>Jam Kerja</TableHead>
                      <TableHead>Lembur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overtimeRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Belum ada data lembur pada tanggal ini.
                        </TableCell>
                      </TableRow>
                    ) : (
                      overtimeRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.department}</TableCell>
                          <TableCell>{row.workingHours.toFixed(2)} jam</TableCell>
                          <TableCell className="font-semibold">{row.overtimeHours.toFixed(2)} jam</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pengajuan Cuti & Izin</CardTitle>
              <CardDescription>Buat pengajuan cuti dan proses approval manager/boss.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Karyawan</Label>
                <Select value={leaveForm.employeeId} onValueChange={(value) => setLeaveForm((prev) => ({ ...prev, employeeId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih karyawan" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name} ({employee.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Jenis Cuti</Label>
                <Select value={leaveForm.type} onValueChange={(value) => setLeaveForm((prev) => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANNUAL">Tahunan</SelectItem>
                    <SelectItem value="SICK">Sakit</SelectItem>
                    <SelectItem value="UNPAID">Tidak Dibayar</SelectItem>
                    <SelectItem value="MATERNITY">Melahirkan</SelectItem>
                    <SelectItem value="OTHER">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tanggal Mulai</Label>
                <Input type="date" value={leaveForm.startDate} onChange={(event) => setLeaveForm((prev) => ({ ...prev, startDate: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Tanggal Selesai</Label>
                <Input type="date" value={leaveForm.endDate} onChange={(event) => setLeaveForm((prev) => ({ ...prev, endDate: event.target.value }))} />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Alasan</Label>
                <Input value={leaveForm.reason} onChange={(event) => setLeaveForm((prev) => ({ ...prev, reason: event.target.value }))} placeholder="Alasan pengajuan" />
              </div>
              <div className="md:col-span-2">
                <Button onClick={handleSubmitLeave} disabled={leaveSubmitting}>
                  {leaveSubmitting ? "Mengajukan..." : "Ajukan Cuti"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval Cuti Pending ({pendingLeaveRows.length})</CardTitle>
              <CardDescription>Disetujui atau ditolak oleh manager/boss.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Approver</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingLeaves ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Memuat data cuti...
                        </TableCell>
                      </TableRow>
                    ) : pendingLeaveRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Tidak ada pengajuan cuti pending.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingLeaveRows.map((leave) => (
                        <TableRow key={leave.id}>
                          <TableCell>
                            <div className="font-medium">{leave.employeeName}</div>
                            <div className="text-xs text-muted-foreground">{leave.department}</div>
                          </TableCell>
                          <TableCell>{leave.type}</TableCell>
                          <TableCell>
                            {new Date(leave.startDate).toLocaleDateString("id-ID")} -{" "}
                            {new Date(leave.endDate).toLocaleDateString("id-ID")}
                          </TableCell>
                          <TableCell>{leave.approverName || "-"}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleApproveLeave(leave.id)}>
                                Setujui
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleRejectLeave(leave.id)}>
                                Tolak
                              </Button>
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
      </Tabs>

      <Dialog open={clockDialogOpen} onOpenChange={setClockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clock In / Clock Out</DialogTitle>
            <DialogDescription>Pilih karyawan dan jenis aksi absensi.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Karyawan</Label>
              <Select value={clockForm.employeeId} onValueChange={(value) => setClockForm((prev) => ({ ...prev, employeeId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih karyawan" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.employeeCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Mode</Label>
              <Select
                value={clockForm.mode}
                onValueChange={(value) => setClockForm((prev) => ({ ...prev, mode: value as "CLOCK_IN" | "CLOCK_OUT" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLOCK_IN">Clock In</SelectItem>
                  <SelectItem value="CLOCK_OUT">Clock Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setClockDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleClockSubmit} disabled={clockSubmitting}>
              {clockSubmitting ? "Menyimpan..." : "Simpan Absensi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
