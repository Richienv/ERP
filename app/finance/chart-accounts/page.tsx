"use client"

import * as React from "react"
import {
  ChevronRight,
  ChevronDown,
  Search,
  Plus,
  Edit,
  Trash,
  Filter,
  Download,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Wallet,
  Building2,
  PieChart
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter, CardAction } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Mock Chart of Accounts data following Indonesian accounting standards
const chartOfAccounts = [
  {
    code: "1000",
    name: "ASET",
    type: "Header",
    level: 1,
    balance: 0,
    children: [
      {
        code: "1100",
        name: "ASET LANCAR",
        type: "Header",
        level: 2,
        balance: 0,
        children: [
          {
            code: "1101",
            name: "Kas",
            type: "Asset",
            level: 3,
            balance: 25000000,
            description: "Kas di tangan"
          },
          {
            code: "1102",
            name: "Bank BCA",
            type: "Asset",
            level: 3,
            balance: 150000000,
            description: "Rekening giro BCA"
          },
          {
            code: "1103",
            name: "Bank Mandiri",
            type: "Asset",
            level: 3,
            balance: 75000000,
            description: "Rekening tabungan Mandiri"
          },
          {
            code: "1201",
            name: "Piutang Dagang",
            type: "Asset",
            level: 3,
            balance: 45000000,
            description: "Piutang dari penjualan"
          },
          {
            code: "1301",
            name: "Persediaan Barang Dagang",
            type: "Asset",
            level: 3,
            balance: 120000000,
            description: "Stok barang untuk dijual"
          }
        ]
      },
      {
        code: "1200",
        name: "ASET TETAP",
        type: "Header",
        level: 2,
        balance: 0,
        children: [
          {
            code: "1201",
            name: "Tanah",
            type: "Asset",
            level: 3,
            balance: 500000000,
            description: "Tanah kantor"
          },
          {
            code: "1202",
            name: "Bangunan",
            type: "Asset",
            level: 3,
            balance: 800000000,
            description: "Gedung kantor"
          },
          {
            code: "1203",
            name: "Peralatan Kantor",
            type: "Asset",
            level: 3,
            balance: 50000000,
            description: "Furniture dan equipment"
          }
        ]
      }
    ]
  },
  {
    code: "2000",
    name: "LIABILITAS",
    type: "Header",
    level: 1,
    balance: 0,
    children: [
      {
        code: "2100",
        name: "LIABILITAS JANGKA PENDEK",
        type: "Header",
        level: 2,
        balance: 0,
        children: [
          {
            code: "2101",
            name: "Utang Dagang",
            type: "Liability",
            level: 3,
            balance: 30000000,
            description: "Utang kepada supplier"
          },
          {
            code: "2102",
            name: "Utang Pajak",
            type: "Liability",
            level: 3,
            balance: 5000000,
            description: "PPh dan PPN yang belum dibayar"
          }
        ]
      }
    ]
  },
  {
    code: "3000",
    name: "EKUITAS",
    type: "Header",
    level: 1,
    balance: 0,
    children: [
      {
        code: "3100",
        name: "Modal Disetor",
        type: "Equity",
        level: 2,
        balance: 1000000000,
        description: "Modal awal pemegang saham"
      },
      {
        code: "3200",
        name: "Laba Ditahan",
        type: "Equity",
        level: 2,
        balance: 200000000,
        description: "Akumulasi laba"
      }
    ]
  },
  {
    code: "4000",
    name: "PENDAPATAN",
    type: "Header",
    level: 1,
    balance: 0,
    children: [
      {
        code: "4100",
        name: "Pendapatan Penjualan",
        type: "Revenue",
        level: 2,
        balance: 500000000,
        description: "Penjualan barang/jasa"
      },
      {
        code: "4200",
        name: "Pendapatan Lain-lain",
        type: "Revenue",
        level: 2,
        balance: 10000000,
        description: "Pendapatan di luar usaha"
      }
    ]
  },
  {
    code: "5000",
    name: "BEBAN",
    type: "Header",
    level: 1,
    balance: 0,
    children: [
      {
        code: "5100",
        name: "Harga Pokok Penjualan",
        type: "Expense",
        level: 2,
        balance: 300000000,
        description: "HPP barang yang dijual"
      },
      {
        code: "5200",
        name: "Beban Operasional",
        type: "Header",
        level: 2,
        balance: 0,
        children: [
          {
            code: "5201",
            name: "Beban Gaji",
            type: "Expense",
            level: 3,
            balance: 50000000,
            description: "Gaji karyawan"
          },
          {
            code: "5202",
            name: "Beban Listrik",
            type: "Expense",
            level: 3,
            balance: 2000000,
            description: "Biaya listrik kantor"
          }
        ]
      }
    ]
  }
]

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const getAccountTypeBadge = (type: string) => {
  switch (type) {
    case "Header":
      return <Badge variant="outline">Header</Badge>
    case "Asset":
      return <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">Aset</Badge>
    case "Liability":
      return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">Liabilitas</Badge>
    case "Equity":
      return <Badge variant="secondary" className="bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800">Ekuitas</Badge>
    case "Revenue":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">Pendapatan</Badge>
    case "Expense":
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">Beban</Badge>
    default:
      return <Badge variant="outline">{type}</Badge>
  }
}

function AccountTreeItem({ account, level = 0 }: { account: any, level?: number }) {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const hasChildren = account.children && account.children.length > 0

  return (
    <>
      <TableRow className={level > 0 ? "bg-muted/30" : ""}>
        <TableCell style={{ paddingLeft: `${level * 24 + 16}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-6" />
            )}
            <span className={`font-mono text-sm ${level === 0 ? "font-bold" : ""}`}>{account.code}</span>
          </div>
        </TableCell>
        <TableCell>
          <span className={level === 0 || level === 1 ? "font-semibold" : ""}>
            {account.name}
          </span>
        </TableCell>
        <TableCell>{getAccountTypeBadge(account.type)}</TableCell>
        <TableCell className="text-right font-mono">
          {account.balance > 0 && formatCurrency(account.balance).replace(/\D00$/, '')}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {account.description}
        </TableCell>
        <TableCell>
          <div className="flex gap-1 justify-end">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Edit className="h-4 w-4" />
            </Button>
            {account.type !== "Header" && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {hasChildren && isExpanded && (
        <>
          {account.children.map((child: any) => (
            <AccountTreeItem
              key={child.code}
              account={child}
              level={level + 1}
            />
          ))}
        </>
      )}
    </>
  )
}

export default function ChartOfAccountsPage() {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [accountTypeFilter, setAccountTypeFilter] = React.useState("all")

  // Calculate stats
  const totalAssets = 1765000000
  const totalLiabilities = 35000000
  const totalEquity = 1200000000
  const netIncome = 158000000

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bagan Akun</h2>
          <p className="text-muted-foreground">
            Kelola struktur akun keuangan (Chart of Accounts)
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Ekspor
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Akun
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl:grid-cols-2 @5xl:grid-cols-4">
        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Aset</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-blue-600">
              {formatCurrency(totalAssets).replace(/\D00$/, '')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-blue-600 text-blue-600">
                <Wallet className="mr-1 size-3" />
                Aktiva
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-blue-600">
              Posisi Keuangan <Activity className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Total kekayaan perusahaan
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Liabilitas</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-red-600">
              {formatCurrency(totalLiabilities).replace(/\D00$/, '')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-red-600 text-red-600">
                <FileText className="mr-1 size-3" />
                Kewajiban
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-red-600">
              Utang & Kewajiban <TrendingDown className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Kewajiban jangka pendek & panjang
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Total Ekuitas</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-purple-600">
              {formatCurrency(totalEquity).replace(/\D00$/, '')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-purple-600 text-purple-600">
                <Building2 className="mr-1 size-3" />
                Modal
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-purple-600">
              Nilai Bersih <PieChart className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Modal disetor & laba ditahan
            </div>
          </CardFooter>
        </Card>

        <Card className="@container/card">
          <CardHeader>
            <CardDescription>Laba Bersih (YTD)</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl text-green-600">
              {formatCurrency(netIncome).replace(/\D00$/, '')}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="border-green-600 text-green-600">
                <TrendingUp className="mr-1 size-3" />
                Profit
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium text-green-600">
              Kinerja Operasional <DollarSign className="size-4" />
            </div>
            <div className="text-muted-foreground">
              Pendapatan dikurangi beban
            </div>
          </CardFooter>
        </Card>
      </div>

      <Tabs defaultValue="tree" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tree">Struktur Akun</TabsTrigger>
          <TabsTrigger value="settings">Pengaturan</TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="space-y-4">
          {/* Filter & Search */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari kode atau nama akun..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Jenis Akun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jenis</SelectItem>
                  <SelectItem value="Asset">Aset</SelectItem>
                  <SelectItem value="Liability">Liabilitas</SelectItem>
                  <SelectItem value="Equity">Ekuitas</SelectItem>
                  <SelectItem value="Revenue">Pendapatan</SelectItem>
                  <SelectItem value="Expense">Beban</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Account Tree Table */}
          <Card>
            <CardHeader>
              <CardTitle>Daftar Akun</CardTitle>
              <CardDescription>
                Struktur hierarki akun untuk pelaporan keuangan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Kode Akun</TableHead>
                      <TableHead>Nama Akun</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="hidden md:table-cell">Deskripsi</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartOfAccounts.map((account) => (
                      <AccountTreeItem key={account.code} account={account} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Bagan Akun</CardTitle>
              <CardDescription>
                Konfigurasi standar akuntansi dan format kode akun
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Standar Akuntansi</Label>
                  <Select defaultValue="psak">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="psak">PSAK (Indonesia)</SelectItem>
                      <SelectItem value="ifrs">IFRS</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format Kode Akun</Label>
                  <Select defaultValue="4digit">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4digit">4 Digit (1000, 1100)</SelectItem>
                      <SelectItem value="6digit">6 Digit (100000, 110000)</SelectItem>
                      <SelectItem value="custom">Custom Format</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mata Uang Pelaporan</Label>
                  <Select defaultValue="idr">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="idr">IDR (Rupiah)</SelectItem>
                      <SelectItem value="usd">USD (Dollar)</SelectItem>
                      <SelectItem value="eur">EUR (Euro)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Periode Tutup Buku</Label>
                  <Select defaultValue="monthly">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Bulanan</SelectItem>
                      <SelectItem value="quarterly">Triwulan</SelectItem>
                      <SelectItem value="annually">Tahunan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}