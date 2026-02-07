"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    Server,
    Search,
    Filter,
    Download,
    RefreshCw
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";
import { mockSystemLogs, systemPerformanceData } from "@/components/documents/reports/data";

export default function SystemReportsPage() {
    const getLogLevelColor = (level: string) => {
        switch (level) {
            case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200';
            case 'ERROR': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'WARNING': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'INFO': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Laporan Sistem</h2>
                    <p className="text-muted-foreground">
                        Monitoring kesehatan sistem, log aktivitas, dan performa server.
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Ekspor Log
                    </Button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Status Sistem</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">Operational</div>
                        <p className="text-xs text-muted-foreground">
                            Uptime 99.98% (30 hari terakhir)
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Request</CardTitle>
                        <Activity className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">12.5K</div>
                        <p className="text-xs text-muted-foreground">
                            +15% dari jam sebelumnya
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">0.05%</div>
                        <p className="text-xs text-muted-foreground">
                            5 error dalam 1 jam terakhir
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Server Load</CardTitle>
                        <Server className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">45%</div>
                        <p className="text-xs text-muted-foreground">
                            CPU Usage (Rata-rata)
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Performance Chart */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Metrik Performa Real-time</CardTitle>
                        <CardDescription>
                            Penggunaan CPU, Memory, dan Request per jam
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={systemPerformanceData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="time"
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
                                />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#8884d8" strokeWidth={2} />
                                <Line type="monotone" dataKey="memory" name="Memory %" stroke="#82ca9d" strokeWidth={2} />
                                <Line type="monotone" dataKey="requests" name="Requests/10" stroke="#ffc658" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Recent Logs */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Log Aktivitas Terbaru</CardTitle>
                        <CardDescription>
                            Catatan kejadian penting dalam sistem
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {mockSystemLogs.slice(0, 5).map((log) => (
                                <div key={log.id} className="flex items-start space-x-4 border-b pb-4 last:border-0 last:pb-0">
                                    <div className={`mt-1 p-1 rounded-full ${log.level === 'CRITICAL' ? 'bg-red-100 text-red-600' :
                                            log.level === 'ERROR' ? 'bg-orange-100 text-orange-600' :
                                                log.level === 'WARNING' ? 'bg-yellow-100 text-yellow-600' :
                                                    'bg-blue-100 text-blue-600'
                                        }`}>
                                        {log.level === 'CRITICAL' || log.level === 'ERROR' ? <AlertTriangle className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                                    </div>
                                    <div className="space-y-1 flex-1">
                                        <p className="text-sm font-medium leading-none">{log.message}</p>
                                        <div className="flex items-center text-xs text-muted-foreground">
                                            <span className="font-mono mr-2">{log.module}</span>
                                            <span>• {log.timestamp.toLocaleTimeString('id-ID')}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Detailed Logs Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Daftar Log Lengkap</CardTitle>
                            <CardDescription>Filter dan cari log spesifik</CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="relative w-[250px]">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Cari pesan log..." className="pl-8 h-9" />
                            </div>
                            <Button variant="outline" size="icon" className="h-9 w-9">
                                <Filter className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[150px]">Waktu</TableHead>
                                <TableHead className="w-[100px]">Level</TableHead>
                                <TableHead className="w-[120px]">Modul</TableHead>
                                <TableHead>Pesan</TableHead>
                                <TableHead className="w-[150px]">User</TableHead>
                                <TableHead className="w-[120px]">IP Address</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {mockSystemLogs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="font-mono text-xs">
                                        {log.timestamp.toLocaleString('id-ID')}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={getLogLevelColor(log.level)}>
                                            {log.level}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium text-xs">{log.module}</TableCell>
                                    <TableCell className="text-sm">{log.message}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{log.user}</TableCell>
                                    <TableCell className="text-xs font-mono text-muted-foreground">{log.ipAddress}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
