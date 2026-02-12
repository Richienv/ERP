"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, UserPlus, Download, RefreshCw } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { AttendanceWidget } from "@/components/hcm/attendance-widget"
import { PayrollSummaryWidget } from "@/components/hcm/payroll-summary"
import { PerformanceWidget } from "@/components/hcm/performance-widget"
import { LeaveRequestWidget } from "@/components/hcm/leave-requests"
import { DetailedStaffActivity } from "@/components/hcm/detailed-staff-activity"
import { DetailedPerformanceTable } from "@/components/hcm/detailed-performance-table"
import { getHCMDashboardData } from "@/app/actions/hcm"
import { toast } from "sonner"

interface HCMDashboardData {
  attendance: {
    present: number
    total: number
    late: number
    onLeave: number
    absent: number
    attendanceRate: number
    timestamp: string
  }
  payroll: {
    gross: number
    deductions: number
    net: number
    status: string
    period: string
  }
  leaves: {
    pendingCount: number
    requests: Array<{
      id: string
      employeeName: string
      type: string
      days: number
      startDate: string
      endDate: string
    }>
  }
  headcount: {
    active: number
    total: number
  }
}

const initialData: HCMDashboardData = {
  attendance: {
    present: 0,
    total: 0,
    late: 0,
    onLeave: 0,
    absent: 0,
    attendanceRate: 0,
    timestamp: new Date().toISOString(),
  },
  payroll: {
    gross: 0,
    deductions: 0,
    net: 0,
    status: "DRAFT",
    period: new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
  },
  leaves: {
    pendingCount: 0,
    requests: [],
  },
  headcount: {
    active: 0,
    total: 0,
  },
}

export default function HCMPage() {
  const [loading, setLoading] = useState(false)
  const [dashboardData, setDashboardData] = useState<HCMDashboardData>(initialData)

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getHCMDashboardData()
      setDashboardData(data as HCMDashboardData)
    } catch {
      toast.error("Gagal memuat dashboard SDM")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  return (
    <div className="flex-1 min-h-screen space-y-6 bg-zinc-50/50 p-4 pt-6 dark:bg-black md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sumber Daya Manusia (SDM)</h2>
          <p className="text-muted-foreground">
            Platform manajemen karyawan, kehadiran, dan payroll terpadu.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => loadDashboard()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Muat Ulang
          </Button>
          <Button variant="outline" asChild>
            <Link href="/hcm/employee-master">
              <Download className="mr-2 h-4 w-4" /> Laporan SDM
            </Link>
          </Button>
          <Button asChild>
            <Link href="/hcm/employee-master">
              <UserPlus className="mr-2 h-4 w-4" /> Karyawan Baru
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <AttendanceWidget stats={dashboardData.attendance} />
        <PayrollSummaryWidget data={dashboardData.payroll} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Karyawan Aktif</CardTitle>
            <CardDescription>Headcount aktif yang bisa di-assign ke operasi.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dashboardData.headcount.active}</p>
            <p className="text-xs text-muted-foreground">Dari total {dashboardData.headcount.total} karyawan</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Cuti Menunggu Approval</CardTitle>
            <CardDescription>Request pending manager/HR approval.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{dashboardData.leaves.pendingCount}</p>
            <p className="text-xs text-muted-foreground">Masuk ke alur approval SDM</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <DetailedStaffActivity />
        <DetailedPerformanceTable />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <LeaveRequestWidget
          requests={dashboardData.leaves.requests}
          pendingCount={dashboardData.leaves.pendingCount}
          onChanged={() => loadDashboard(true)}
        />
        <PerformanceWidget />
      </div>

      <Tabs defaultValue="employees" className="mt-6 space-y-6">
        <TabsList>
          <TabsTrigger value="employees">Database Karyawan</TabsTrigger>
          <TabsTrigger value="payroll">Payroll & Benefit</TabsTrigger>
          <TabsTrigger value="recruitment">Rekrutmen</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>Direktori Karyawan</CardTitle>
              <CardDescription>Kelola data kontrak, posisi, dan profil personal.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-8 text-muted-foreground">
                <Users className="mb-4 h-12 w-12 opacity-20" />
                <p>Kelola data lengkap pada menu Data Karyawan.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card>
            <CardHeader>
              <CardTitle>Riwayat Penggajian</CardTitle>
              <CardDescription>Arsip slip gaji dan laporan pajak (PPh 21).</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Gunakan menu Penggajian untuk proses payroll periodik.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
