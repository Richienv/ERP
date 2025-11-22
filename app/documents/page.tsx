"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    FileText,
    Database,
    BookOpen,
    Settings,
    Search,
    FolderOpen,
    FileCheck,
    Clock
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";

export default function DocumentsDashboard() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dokumen & Sistem</h2>
                    <p className="text-muted-foreground">
                        Pusat pengelolaan data master, laporan, dan dokumentasi sistem.
                    </p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative w-full max-w-xl">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Cari dokumen, data master, atau panduan..." className="pl-8" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {/* Data Master Card */}
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer group">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl">Data Master</CardTitle>
                            <Database className="h-6 w-6 text-blue-600 group-hover:scale-110 transition-transform" />
                        </div>
                        <CardDescription>
                            Pengaturan data referensi utama sistem
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2" /> Kategori & Unit</li>
                            <li className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2" /> Lokasi & Gudang</li>
                            <li className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2" /> Mata Uang & Pajak</li>
                        </ul>
                        <Button variant="ghost" className="w-full mt-4 group-hover:bg-blue-50 group-hover:text-blue-600" asChild>
                            <Link href="/documents/master">
                                Kelola Data Master
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                {/* System Reports Card */}
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer group">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl">Laporan Sistem</CardTitle>
                            <FileText className="h-6 w-6 text-green-600 group-hover:scale-110 transition-transform" />
                        </div>
                        <CardDescription>
                            Log aktivitas dan laporan teknis
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" /> Audit Log User</li>
                            <li className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" /> Error Logs</li>
                            <li className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" /> Performa Sistem</li>
                        </ul>
                        <Button variant="ghost" className="w-full mt-4 group-hover:bg-green-50 group-hover:text-green-600" asChild>
                            <Link href="/documents/reports">
                                Lihat Laporan
                            </Link>
                        </Button>
                    </CardContent>
                </Card>

                {/* Documentation Card */}
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer group">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl">Dokumentasi</CardTitle>
                            <BookOpen className="h-6 w-6 text-purple-600 group-hover:scale-110 transition-transform" />
                        </div>
                        <CardDescription>
                            Panduan penggunaan dan referensi API
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-2" /> User Manual</li>
                            <li className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-2" /> API Documentation</li>
                            <li className="flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-2" /> Release Notes</li>
                        </ul>
                        <Button variant="ghost" className="w-full mt-4 group-hover:bg-purple-50 group-hover:text-purple-600" asChild>
                            <Link href="/documents/docs">
                                Buka Dokumentasi
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Documents */}
            <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">Dokumen Terakhir Diakses</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[
                        { name: "Panduan Modul Sales v2.1", type: "PDF", date: "2 jam yang lalu", icon: FileCheck },
                        { name: "Master Data Produk 2024", type: "XLSX", date: "5 jam yang lalu", icon: Database },
                        { name: "System Audit Log - Nov", type: "LOG", date: "Hari ini, 09:00", icon: Clock },
                        { name: "Kebijakan Retur Barang", type: "DOCX", date: "Kemarin", icon: FileText },
                    ].map((doc, i) => (
                        <div key={i} className="flex items-center p-4 border rounded-lg bg-card hover:bg-accent transition-colors cursor-pointer">
                            <div className="p-2 bg-secondary rounded-full mr-4">
                                <doc.icon className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">{doc.name}</p>
                                <div className="flex items-center text-xs text-muted-foreground mt-1">
                                    <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px] mr-2">{doc.type}</span>
                                    <span>{doc.date}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
