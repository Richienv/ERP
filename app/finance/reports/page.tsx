"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
    Download,
    Printer,
    Calendar,
    TrendingUp,
    TrendingDown,
    DollarSign,
    PieChart
} from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line
} from "recharts";
import {
    profitLossData,
    balanceSheetData,
    monthlyRevenueData,
    FinancialReportItem
} from "@/components/finance/reports/data";
import { cn } from "@/lib/utils";

export default function FinancialReportsPage() {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const ReportTable = ({ data }: { data: FinancialReportItem[] }) => (
        <div className="rounded-md border">
            <div className="w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b">
                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Keterangan</th>
                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Nilai (IDR)</th>
                        </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                        {data.map((item) => (
                            <tr
                                key={item.id}
                                className={cn(
                                    "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
                                    item.type === "HEADER" && "bg-muted/30 font-semibold",
                                    item.type === "TOTAL" && "bg-muted/50 font-bold border-t-2"
                                )}
                            >
                                <td className="p-4 align-middle">
                                    <div style={{ paddingLeft: `${item.level * 20}px` }}>
                                        {item.name}
                                    </div>
                                </td>
                                <td className={cn(
                                    "p-4 align-middle text-right",
                                    item.amount < 0 && "text-red-600"
                                )}>
                                    {item.type === "HEADER" ? "" : formatCurrency(item.amount)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Laporan Keuangan</h2>
                    <p className="text-muted-foreground">
                        Analisis kinerja keuangan dan posisi neraca perusahaan.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                        <Calendar className="mr-2 h-4 w-4" />
                        Nov 2024
                    </Button>
                    <Button variant="outline" size="sm">
                        <Printer className="mr-2 h-4 w-4" />
                        Cetak
                    </Button>
                    <Button size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Ekspor PDF
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="overview">Ringkasan</TabsTrigger>
                    <TabsTrigger value="profit-loss">Laba Rugi</TabsTrigger>
                    <TabsTrigger value="balance-sheet">Neraca</TabsTrigger>
                    <TabsTrigger value="cash-flow">Arus Kas</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">Rp 1.400.000.000</div>
                                <p className="text-xs text-muted-foreground">+20.1% dari bulan lalu</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Laba Bersih</CardTitle>
                                <TrendingUp className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">Rp 259.350.000</div>
                                <p className="text-xs text-muted-foreground">Margin Laba: 18.5%</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Beban</CardTitle>
                                <TrendingDown className="h-4 w-4 text-red-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">Rp 217.500.000</div>
                                <p className="text-xs text-muted-foreground">+4% dari bulan lalu</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Kas Tersedia</CardTitle>
                                <PieChart className="h-4 w-4 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">Rp 450.000.000</div>
                                <p className="text-xs text-muted-foreground">Cukup untuk 2.5 bulan ops</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                        <Card className="col-span-4">
                            <CardHeader>
                                <CardTitle>Tren Pendapatan & Beban</CardTitle>
                                <CardDescription>Perbandingan performa 6 bulan terakhir</CardDescription>
                            </CardHeader>
                            <CardContent className="pl-2">
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={monthlyRevenueData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis
                                            dataKey="name"
                                            stroke="#888888"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            stroke="#888888"
                                            fontSize={12}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(value) => `Rp${value / 1000000}jt`}
                                        />
                                        <Tooltip
                                            formatter={(value: number) => formatCurrency(value)}
                                            cursor={{ fill: 'transparent' }}
                                        />
                                        <Legend />
                                        <Bar dataKey="revenue" name="Pendapatan" fill="#16a34a" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="expense" name="Beban" fill="#dc2626" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card className="col-span-3">
                            <CardHeader>
                                <CardTitle>Rasio Keuangan</CardTitle>
                                <CardDescription>Indikator kesehatan finansial</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-8">
                                    <div className="flex items-center">
                                        <div className="ml-4 space-y-1">
                                            <p className="text-sm font-medium leading-none">Current Ratio</p>
                                            <p className="text-sm text-muted-foreground">Aset Lancar / Liabilitas Lancar</p>
                                        </div>
                                        <div className="ml-auto font-bold text-green-600">4.4x</div>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="ml-4 space-y-1">
                                            <p className="text-sm font-medium leading-none">Gross Profit Margin</p>
                                            <p className="text-sm text-muted-foreground">Laba Kotor / Pendapatan</p>
                                        </div>
                                        <div className="ml-auto font-bold">39.2%</div>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="ml-4 space-y-1">
                                            <p className="text-sm font-medium leading-none">Net Profit Margin</p>
                                            <p className="text-sm text-muted-foreground">Laba Bersih / Pendapatan</p>
                                        </div>
                                        <div className="ml-auto font-bold">18.5%</div>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="ml-4 space-y-1">
                                            <p className="text-sm font-medium leading-none">Debt to Equity</p>
                                            <p className="text-sm text-muted-foreground">Total Hutang / Ekuitas</p>
                                        </div>
                                        <div className="ml-auto font-bold text-green-600">0.21x</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="profit-loss" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Laporan Laba Rugi</CardTitle>
                            <CardDescription>
                                Periode: 1 November 2024 - 30 November 2024
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ReportTable data={profitLossData} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="balance-sheet" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Laporan Neraca</CardTitle>
                            <CardDescription>
                                Per Tanggal: 30 November 2024
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ReportTable data={balanceSheetData} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="cash-flow" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Laporan Arus Kas</CardTitle>
                            <CardDescription>
                                Periode: 1 November 2024 - 30 November 2024
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center h-[400px]">
                            <div className="text-center space-y-4">
                                <div className="p-4 bg-muted rounded-full inline-block">
                                    <TrendingUp className="h-12 w-12 text-muted-foreground" />
                                </div>
                                <h3 className="text-xl font-semibold">Laporan Arus Kas</h3>
                                <p className="text-muted-foreground max-w-md">
                                    Fitur laporan arus kas otomatis sedang dalam pengembangan. Saat ini silakan gunakan laporan Laba Rugi dan Neraca sebagai referensi.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
