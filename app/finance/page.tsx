import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconCurrencyDollar, IconChartLine, IconFileText, IconCalendar } from "@tabler/icons-react"

export default function FinancePage() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Keuangan</h1>
            <p className="text-muted-foreground">
              Kelola keuangan perusahaan dengan lengkap dan terintegrasi
            </p>
          </div>
          <Badge variant="secondary">
            <IconCalendar className="mr-1 h-3 w-3" />
            Coming Soon
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chart of Accounts</CardTitle>
            <IconFileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Kelola bagan akun (chart of accounts) perusahaan sesuai standar akuntansi Indonesia
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jurnal Umum</CardTitle>
            <IconFileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Pencatatan transaksi keuangan harian dalam jurnal umum
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laporan Keuangan</CardTitle>
            <IconChartLine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CardDescription>
              Laporan neraca, rugi laba, dan arus kas sesuai PSAK Indonesia
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconCurrencyDollar className="h-5 w-5" />
              Modul Keuangan ERP Indonesia
            </CardTitle>
            <CardDescription>
              Sistem keuangan terintegrasi untuk perusahaan Indonesia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <h4 className="font-semibold">Fitur yang akan datang:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                <li>• Chart of Accounts dengan standar akuntansi Indonesia</li>
                <li>• Jurnal umum dan posting otomatis</li>
                <li>• Laporan keuangan (Neraca, Rugi Laba, Arus Kas)</li>
                <li>• Integrasi dengan modul inventory dan sales</li>
                <li>• Compliance dengan PSAK dan pajak Indonesia</li>
                <li>• Multi-currency support untuk transaksi internasional</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}