"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Zap,
  Clock,
  TrendingDown,
  Plus,
  Download,
  Filter
} from "lucide-react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ActionCenter } from "@/components/procurement/action-center";
import { ProcurementPipeline } from "@/components/procurement/procurement-pipeline";
import { SpendAnalyticsWidget } from "@/components/procurement/spend-analytics";
import { VendorPerformanceWidget } from "@/components/procurement/vendor-performance";

export default function ProcurementDashboard() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 bg-zinc-50/50 dark:bg-black min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard Pengadaan</h2>
          <p className="text-muted-foreground">
            Command Center untuk Buyer & Manager: Monitor RFQ, PO, dan Performa Vendor
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Laporan Bulanan
          </Button>
          <Button asChild>
            <Link href="/procurement/orders/new">
              <Plus className="mr-2 h-4 w-4" /> Buat RFQ / PO
            </Link>
          </Button>
        </div>
      </div>

      {/* Top: Operational Task Summary (Action Center) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <ActionCenter />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview & Pipeline</TabsTrigger>
          <TabsTrigger value="spend">Analisis Spend & Budget</TabsTrigger>
          <TabsTrigger value="vendors">Performa Vendor</TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW */}
        <TabsContent value="overview" className="space-y-6">

          {/* Process KPIs Row */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cycle Time (PR to PO)</CardTitle>
                <Clock className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">4.2 Hari</div>
                <p className="text-xs text-muted-foreground">-0.5 hari dari rata-rata</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Emergency Ratio</CardTitle>
                <Zap className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">5.8%</div>
                <p className="text-xs text-muted-foreground">Target: &lt; 5% (Warning)</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Purchase Price Variance</CardTitle>
                <TrendingDown className="h-4 w-4 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">-2.3%</div>
                <p className="text-xs text-muted-foreground">Hemat vs Budget standar</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">PO Accuracy</CardTitle>
                <ShoppingCart className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">98.5%</div>
                <p className="text-xs text-muted-foreground">Kecocokan invoice vs PO</p>
              </CardContent>
            </Card>
          </div>

          {/* Pipeline & Analytics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
            <ProcurementPipeline />
            <SpendAnalyticsWidget />
          </div>

          {/* Vendor Table Preview */}
          <div className="grid grid-cols-1">
            <VendorPerformanceWidget />
          </div>

        </TabsContent>

        {/* TAB 2: SPEND (Placeholder for future expansion) */}
        <TabsContent value="spend">
          <Card>
            <CardHeader>
              <CardTitle>Spend Analysis Deep Dive</CardTitle>
              <CardDescription>Detail pengeluaran per kategori, departemen, dan project.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground py-8 text-center italic">Modul analisis mendalam akan hadir segera...</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: VENDORS (Placeholder for future expansion) */}
        <TabsContent value="vendors">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Management</CardTitle>
              <CardDescription>Database lengkap, kontrak, dan penilaian kinerja supplier.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-4">
                <VendorPerformanceWidget />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}