import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconUsers, IconCoin, IconCalendarEvent, IconId } from "@tabler/icons-react"

export default function HCMPage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sumber Daya Manusia (SDM)</h1>
            <p className="text-muted-foreground">
              Kelola karyawan, penggajian, dan administrasi HR dengan sistem terintegrasi
            </p>
          </div>
          <Badge variant="secondary">
            <IconCalendarEvent className="mr-1 h-3 w-3" />
            Coming Soon
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Karyawan</CardTitle>
            <IconId className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Database lengkap karyawan dengan informasi personal dan profesional
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Penggajian</CardTitle>
            <IconCoin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Sistem penggajian otomatis dengan perhitungan pajak dan BPJS
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absensi</CardTitle>
            <IconCalendarEvent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Tracking kehadiran dan manajemen cuti karyawan
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUsers className="h-5 w-5" />
              Modul HCM ERP Indonesia
            </CardTitle>
            <CardDescription>
              Human Capital Management sesuai regulasi ketenagakerjaan Indonesia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <h4 className="font-semibold">Fitur yang akan datang:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Master data karyawan dengan NIK dan NPWP</li>
                <li>• Sistem penggajian dengan PPh 21 dan BPJS</li>
                <li>• Absensi digital dengan integrasi fingerprint</li>
                <li>• Manajemen cuti sesuai UU Ketenagakerjaan</li>
                <li>• Performance appraisal dan KPI tracking</li>
                <li>• Laporan HR dan compliance</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}