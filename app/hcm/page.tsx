"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, UserPlus, FileText, Download, Filter } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { AttendanceWidget } from "@/components/hcm/attendance-widget"
import { PayrollSummaryWidget } from "@/components/hcm/payroll-summary"
import { PerformanceWidget } from "@/components/hcm/performance-widget"
import { LeaveRequestWidget } from "@/components/hcm/leave-requests"
import { DetailedStaffActivity } from "@/components/hcm/detailed-staff-activity"
import { DetailedPerformanceTable } from "@/components/hcm/detailed-performance-table" // NEW

export default function HCMPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 bg-zinc-50/50 dark:bg-black min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sumber Daya Manusia (SDM)</h2>
          <p className="text-muted-foreground">
            Platform manajemen karyawan, kehadiran, dan payroll terpadu.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Laporan SDM
          </Button>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" /> Karyawan Baru
          </Button>
        </div>
      </div>

      {/* Top Section: Today's Overview (Real-time) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AttendanceWidget />
        <PayrollSummaryWidget />
      </div>

      {/* NEW: Detailed Staff Activity Section (War Room Style) */}
      <div>
        <DetailedStaffActivity />
        <DetailedPerformanceTable />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <LeaveRequestWidget />
        <PerformanceWidget />
      </div>

      {/* Tabs for Deeper Management */}
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
              <div className="flex items-center justify-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Users className="h-12 w-12 mb-4 opacity-20" />
                <p>Modul Database Karyawan Lengkap akan ditampilkan di sini.</p>
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
              <p className="text-sm text-muted-foreground">Silakan gunakan widget Payroll di atas untuk periode berjalan.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}