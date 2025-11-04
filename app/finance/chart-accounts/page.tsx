"use client"

import * as React from "react"
import { IconPlus, IconEdit, IconTrash, IconChevronRight, IconChevronDown, IconSearch } from "@tabler/icons-react"

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
    minimumFractionDigits: 0
  }).format(amount)
}

const getAccountTypeBadge = (type: string) => {
  switch (type) {
    case "Header":
      return <Badge variant="outline">Header</Badge>
    case "Asset":
      return <Badge variant="default">Aset</Badge>
    case "Liability":
      return <Badge variant="destructive">Liabilitas</Badge>
    case "Equity":
      return <Badge variant="secondary">Ekuitas</Badge>
    case "Revenue":
      return <Badge className="bg-green-500">Pendapatan</Badge>
    case "Expense":
      return <Badge className="bg-orange-500">Beban</Badge>
    default:
      return <Badge variant="outline">{type}</Badge>
  }
}

function AccountTreeItem({ account, level = 0 }: { account: any, level?: number }) {
  const [isExpanded, setIsExpanded] = React.useState(true)
  const hasChildren = account.children && account.children.length > 0

  return (
    <>
      <TableRow className={level > 0 ? "bg-muted/50" : ""}>
        <TableCell style={{ paddingLeft: `${level * 24 + 16}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <IconChevronDown className="h-3 w-3" />
                ) : (
                  <IconChevronRight className="h-3 w-3" />
                )}
              </Button>
            )}
            <span className="font-mono text-sm">{account.code}</span>
          </div>
        </TableCell>
        <TableCell>
          <span className={level === 0 || level === 1 ? "font-semibold" : ""}>
            {account.name}
          </span>
        </TableCell>
        <TableCell>{getAccountTypeBadge(account.type)}</TableCell>
        <TableCell className="text-right">
          {account.balance > 0 && formatCurrency(account.balance)}
        </TableCell>
        <TableCell>
          {account.description}
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm">
              <IconEdit className="h-4 w-4" />
            </Button>
            {account.type !== "Header" && (
              <Button variant="ghost" size="sm">
                <IconTrash className="h-4 w-4" />
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
              <h1 className="text-lg font-semibold md:text-2xl">Bagan Akun (Chart of Accounts)</h1>
              <p className="text-sm text-muted-foreground">
                Kelola struktur akun keuangan sesuai standar akuntansi Indonesia
              </p>
            </div>
            <Button>
              <IconPlus className="mr-2 h-4 w-4" />
              Tambah Akun
            </Button>
          </div>

          <Tabs defaultValue="tree" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tree">Struktur Akun</TabsTrigger>
              <TabsTrigger value="balance">Neraca Saldo</TabsTrigger>
              <TabsTrigger value="settings">Pengaturan</TabsTrigger>
            </TabsList>

            <TabsContent value="tree" className="space-y-4">
              {/* Search and Filter */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Filter & Pencarian</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4 md:flex-row md:items-end">
                    <div className="flex-1">
                      <Label htmlFor="search">Cari Akun</Label>
                      <div className="relative">
                        <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="search"
                          placeholder="Kode akun atau nama akun..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="min-w-[200px]">
                      <Label>Jenis Akun</Label>
                      <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih jenis akun" />
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
                </CardContent>
              </Card>

              {/* Account Tree */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Struktur Bagan Akun</CardTitle>
                  <CardDescription>
                    Struktur hierarki akun sesuai standar akuntansi Indonesia (PSAK)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kode</TableHead>
                          <TableHead>Nama Akun</TableHead>
                          <TableHead>Jenis</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                          <TableHead>Deskripsi</TableHead>
                          <TableHead>Aksi</TableHead>
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

            <TabsContent value="balance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Neraca Saldo</CardTitle>
                  <CardDescription>
                    Ringkasan saldo akun per tanggal tertentu
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total Aset</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(1765000000)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total Liabilitas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(35000000)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Total Ekuitas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(1200000000)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Laba Bersih</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(158000000)}
                        </div>
                      </CardContent>
                    </Card>
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
                    <div>
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
                    <div>
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
                    <div>
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
                    <div>
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
      </SidebarInset>
    </SidebarProvider>
  )
}