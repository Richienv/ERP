"use client"

import * as React from "react"
import { IconClock, IconCalendar, IconUser, IconTrendingUp, IconAlertTriangle } from "@tabler/icons-react"

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

// Mock attendance data
const attendanceToday = [
  {
    employeeId: "EMP-001",
    name: "Andi Sutrisno",
    department: "IT",
    clockIn: "08:15",
    clockOut: "17:30",
    breakTime: "60",
    workingHours: "8.75",
    overtime: "0.5",
    status: "Present",
    location: "Kantor Pusat"
  },
  {
    employeeId: "EMP-002", 
    name: "Sari Wijaya",
    department: "Finance",
    clockIn: "08:00",
    clockOut: "17:00", 
    breakTime: "60",
    workingHours: "8.0",
    overtime: "0",
    status: "Present",
    location: "Kantor Pusat"
  },
  {
    employeeId: "EMP-003",
    name: "Budi Santoso",
    department: "Sales", 
    clockIn: "09:30",
    clockOut: "-",
    breakTime: "-",
    workingHours: "-",
    overtime: "-",
    status: "Late",
    location: "Field Visit"
  },
  {
    employeeId: "EMP-004",
    name: "Maya Sari",
    department: "HR",
    clockIn: "-",
    clockOut: "-",
    breakTime: "-", 
    workingHours: "-",
    overtime: "-",
    status: "Leave",
    location: "-"
  },
  {
    employeeId: "EMP-005",
    name: "Dewi Lestari",
    department: "Marketing",
    clockIn: "08:45",
    clockOut: "18:15",
    breakTime: "90",
    workingHours: "8.0",
    overtime: "1.25",
    status: "Present",
    location: "WFH"
  }
]

const monthlyStats = {
  totalEmployees: 25,
  presentToday: 20,
  lateToday: 3,
  absentToday: 2,
  averageWorkingHours: 8.2,
  totalOvertimeHours: 45.5,
  onTimePercentage: 85,
  attendanceRate: 92
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "Present":
      return <Badge variant="default">Hadir</Badge>
    case "Late":
      return <Badge variant="destructive">Terlambat</Badge>
    case "Leave":
      return <Badge variant="secondary">Cuti</Badge>
    case "Absent":
      return <Badge variant="outline">Absen</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function AttendancePage() {
  const [selectedDate, setSelectedDate] = React.useState("2024-11-03")
  const [selectedDepartment, setSelectedDepartment] = React.useState("all")

  const filteredAttendance = attendanceToday.filter(att => 
    selectedDepartment === "all" || att.department === selectedDepartment
  )

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
              <h1 className="text-lg font-semibold md:text-2xl">Pelacakan Absensi</h1>
              <p className="text-sm text-muted-foreground">
                Monitor kehadiran karyawan, jam kerja, dan lembur
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <IconCalendar className="mr-2 h-4 w-4" />
                Atur Jadwal
              </Button>
              <Button>
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
              {/* Date and Filter */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Filter Absensi</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div>
                      <Label>Tanggal</Label>
                      <Input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-[200px]"
                      />
                    </div>
                    <div>
                      <Label>Departemen</Label>
                      <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Departemen</SelectItem>
                          <SelectItem value="IT">IT</SelectItem>
                          <SelectItem value="Finance">Finance</SelectItem>
                          <SelectItem value="Sales">Sales</SelectItem>
                          <SelectItem value="HR">HR</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Daily Stats */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Hadir Hari Ini</CardTitle>
                    <IconUser className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {monthlyStats.presentToday}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      dari {monthlyStats.totalEmployees} karyawan
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Terlambat</CardTitle>
                    <IconAlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {monthlyStats.lateToday}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Karyawan terlambat
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tidak Hadir</CardTitle>
                    <IconUser className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {monthlyStats.absentToday}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Absen/Sakit/Izin
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tingkat Kehadiran</CardTitle>
                    <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {monthlyStats.attendanceRate}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Bulan ini
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Attendance Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Absensi Hari Ini - {new Date(selectedDate).toLocaleDateString('id-ID')}
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
                          <TableHead>Istirahat</TableHead>
                          <TableHead>Jam Kerja</TableHead>
                          <TableHead>Lembur</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Lokasi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAttendance.map((attendance) => (
                          <TableRow key={attendance.employeeId}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{attendance.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {attendance.employeeId} • {attendance.department}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">
                              {attendance.clockIn}
                            </TableCell>
                            <TableCell className="font-mono">
                              {attendance.clockOut}
                            </TableCell>
                            <TableCell>{attendance.breakTime} min</TableCell>
                            <TableCell>{attendance.workingHours} jam</TableCell>
                            <TableCell>{attendance.overtime} jam</TableCell>
                            <TableCell>{getStatusBadge(attendance.status)}</TableCell>
                            <TableCell>{attendance.location}</TableCell>
                          </TableRow>
                        ))}
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
                  <CardDescription>
                    Ringkasan kehadiran karyawan bulan ini
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Rata-rata Jam Kerja</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {monthlyStats.averageWorkingHours} jam
                        </div>
                        <p className="text-sm text-muted-foreground">Per hari</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Total Lembur</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {monthlyStats.totalOvertimeHours} jam
                        </div>
                        <p className="text-sm text-muted-foreground">Bulan ini</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Ketepatan Waktu</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {monthlyStats.onTimePercentage}%
                        </div>
                        <p className="text-sm text-muted-foreground">Tepat waktu</p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="overtime" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Manajemen Lembur</CardTitle>
                  <CardDescription>
                    Pengaturan dan approval lembur karyawan
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Request Lembur</span>
                      <span className="text-sm text-muted-foreground">Ajukan permohonan lembur</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Approval Lembur</span>
                      <span className="text-sm text-muted-foreground">Setujui permintaan lembur</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Laporan Lembur</span>
                      <span className="text-sm text-muted-foreground">Rekapitulasi jam lembur</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Kalkulasi Upah</span>
                      <span className="text-sm text-muted-foreground">Hitung upah lembur</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leave" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Manajemen Cuti & Izin</CardTitle>
                  <CardDescription>
                    Kelola permohonan cuti dan izin karyawan
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Pengajuan Cuti</span>
                      <span className="text-sm text-muted-foreground">Form cuti karyawan</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Approval Cuti</span>
                      <span className="text-sm text-muted-foreground">Setujui permohonan cuti</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Saldo Cuti</span>
                      <span className="text-sm text-muted-foreground">Cek sisa cuti karyawan</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex-col">
                      <span className="font-medium">Kalender Cuti</span>
                      <span className="text-sm text-muted-foreground">Jadwal cuti tim</span>
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