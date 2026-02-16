"use client";

import { useState } from "react";
import {
  Factory,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  ClipboardCheck,
  Settings,
  Package,
  CheckCircle,
  Plus,
  Activity,
  Wrench,
  Gauge,
  Zap,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface DashboardData {
  productionHealth: {
    oee: number;
    availability: number;
    performance: number;
    quality: number;
  };
  workOrders: {
    total: number;
    inProgress: number;
    completedThisMonth: number;
    productionThisMonth: number;
    plannedThisMonth: number;
  };
  machines: {
    total: number;
    running: number;
    idle: number;
    maintenance: number;
    breakdown: number;
    avgHealth: number;
    totalCapacity: number;
  };
  quality: {
    passRate: number;
    totalInspections: number;
    passCount: number;
    failCount: number;
    recentInspections: Array<{
      id: string;
      batchNumber: string;
      material: string;
      inspector: string;
      status: string;
      score: number;
      date: string;
    }>;
  };
  recentOrders: Array<{
    id: string;
    number: string;
    product: string;
    plannedQty: number;
    actualQty: number;
    status: string;
    progress: number;
  }>;
  alerts: Array<{
    type: 'error' | 'warning' | 'info';
    title: string;
    message: string;
  }>;
}

interface Props {
  initialData: DashboardData;
}

function statusLabel(status: string) {
  const map: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    PLANNED: { label: 'Planned', dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-700' },
    IN_PROGRESS: { label: 'In Progress', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700' },
    COMPLETED: { label: 'Completed', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700' },
    ON_HOLD: { label: 'On Hold', dot: 'bg-orange-500', bg: 'bg-orange-50 border-orange-300', text: 'text-orange-700' },
    CANCELLED: { label: 'Cancelled', dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-500' },
  }
  return map[status] || { label: status, dot: 'bg-zinc-400', bg: 'bg-zinc-100 border-zinc-300', text: 'text-zinc-700' }
}

export function ManufacturingDashboardClient({ initialData }: Props) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/manufacturing/dashboard');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const oee = data.productionHealth.oee || 0;

  return (
    <div className="flex-1 p-4 md:p-8 pt-6 max-w-7xl mx-auto space-y-4">

      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-[6px] border-l-blue-400">
          <div className="flex items-center gap-3">
            <Factory className="h-5 w-5 text-blue-500" />
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Dashboard Manufaktur
              </h1>
              <p className="text-zinc-400 text-xs font-medium mt-0.5">
                Overview produksi & status pabrik real-time
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/manufacturing/orders">
              <Button variant="outline" className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors">
                <Package className="mr-1.5 h-3.5 w-3.5" /> Work Orders
              </Button>
            </Link>
            <Link href="/manufacturing/work-centers">
              <Button variant="outline" className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors">
                <Settings className="mr-1.5 h-3.5 w-3.5" /> Work Centers
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={fetchDashboard}
              disabled={refreshing}
              className="border-2 border-zinc-300 dark:border-zinc-600 font-bold uppercase text-[10px] tracking-wide h-10 px-4 hover:border-zinc-500 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Link href="/manufacturing/orders">
              <Button className="bg-blue-500 text-white hover:bg-blue-600 border-2 border-blue-600 font-black uppercase text-[10px] tracking-wide h-10 px-5 shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-[1px] transition-all">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Order
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Alerts ────────────────────────────────────────────────── */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, i) => (
            <div
              key={i}
              className={`border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden ${
                alert.type === 'error' ? 'bg-red-50 dark:bg-red-950/20 border-l-[5px] border-l-red-500' :
                alert.type === 'warning' ? 'bg-amber-50 dark:bg-amber-950/20 border-l-[5px] border-l-amber-500' :
                'bg-blue-50 dark:bg-blue-950/20 border-l-[5px] border-l-blue-500'
              }`}
            >
              <div className="px-5 py-3 flex items-center gap-3">
                {alert.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-zinc-900 dark:text-white">{alert.title}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{alert.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── OEE + KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* OEE */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-zinc-900 dark:bg-zinc-950 overflow-hidden">
          <div className="p-4 text-center">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Overall OEE</span>
              <Gauge className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="relative inline-flex items-center justify-center my-1">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="none" className="text-zinc-700" />
                <circle
                  cx="40" cy="40" r="32"
                  stroke="currentColor" strokeWidth="6" fill="none"
                  strokeDasharray={201}
                  strokeDashoffset={201 - (201 * oee) / 100}
                  className={oee >= 85 ? 'text-emerald-400' : oee >= 60 ? 'text-amber-400' : 'text-red-400'}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-2xl font-black text-white">{oee}%</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-medium block">Target: 85%</span>
          </div>
        </div>

        {/* Availability */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Availability</span>
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <div className={`text-xl font-black ${(data.productionHealth.availability || 0) >= 85 ? 'text-emerald-600' : (data.productionHealth.availability || 0) >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
              {data.productionHealth.availability || 0}%
            </div>
            <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
              Machine uptime
            </span>
          </div>
        </div>

        {/* Performance */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Performance</span>
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
            <div className={`text-xl font-black ${(data.productionHealth.performance || 0) >= 85 ? 'text-emerald-600' : (data.productionHealth.performance || 0) >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
              {data.productionHealth.performance || 0}%
            </div>
            <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
              Kecepatan produksi
            </span>
          </div>
        </div>

        {/* Quality */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Quality</span>
              <Target className="h-4 w-4 text-emerald-500" />
            </div>
            <div className={`text-xl font-black ${(data.productionHealth.quality || 0) >= 85 ? 'text-emerald-600' : (data.productionHealth.quality || 0) >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
              {data.productionHealth.quality || 0}%
            </div>
            <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
              First pass yield
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total Orders</span>
              <Package className="h-4 w-4 text-zinc-300" />
            </div>
            <div className="text-xl font-black text-zinc-900 dark:text-white">{data.workOrders.total || 0}</div>
          </div>
        </div>
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">In Progress</span>
              <Factory className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-xl font-black text-amber-600">{data.workOrders.inProgress || 0}</div>
          </div>
        </div>
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Selesai</span>
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-xl font-black text-emerald-600">{data.workOrders.completedThisMonth || 0}</div>
          </div>
        </div>
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Mesin Aktif</span>
              <Settings className="h-4 w-4 text-zinc-300" />
            </div>
            <div className="text-xl font-black text-zinc-900 dark:text-white">{data.machines.running || 0}<span className="text-zinc-400 text-sm">/{data.machines.total || 0}</span></div>
          </div>
        </div>
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pass Rate</span>
              <ClipboardCheck className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-xl font-black text-blue-600">{data.quality.passRate || 0}%</div>
          </div>
        </div>
      </div>

      {/* ── Two Column: Machine Status + Recent Orders ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Machine Status */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-blue-400">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-blue-600" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                Status Mesin
              </h3>
            </div>
            <Link href="/manufacturing/work-centers">
              <Button variant="outline" className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-8 px-3 hover:border-zinc-500 transition-colors">
                Lihat Semua
              </Button>
            </Link>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-3 border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
                <p className="text-2xl font-black text-emerald-600">{data.machines.running || 0}</p>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">Running</p>
              </div>
              <div className="p-3 border-2 border-zinc-300 bg-zinc-50 dark:bg-zinc-800/50">
                <p className="text-2xl font-black text-zinc-600 dark:text-zinc-300">{data.machines.idle || 0}</p>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">Idle</p>
              </div>
              <div className="p-3 border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                <p className="text-2xl font-black text-amber-600">{data.machines.maintenance || 0}</p>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">Maint.</p>
              </div>
              <div className={`p-3 border-2 ${(data.machines.breakdown || 0) > 0 ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : 'border-red-300 bg-red-50 dark:bg-red-950/10'}`}>
                <p className={`text-2xl font-black ${(data.machines.breakdown || 0) > 0 ? 'text-red-600' : 'text-red-400'}`}>{data.machines.breakdown || 0}</p>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide">Down</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t-2 border-black/10">
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Average Health</span>
                <span className="text-xs font-black text-zinc-900 dark:text-white">{data.machines.avgHealth}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 border border-black/10">
                <div
                  className={`h-full transition-all ${
                    data.machines.avgHealth >= 80 ? 'bg-emerald-500' :
                    data.machines.avgHealth >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${data.machines.avgHealth}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-blue-400">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
                Work Orders Terbaru
              </h3>
            </div>
            <Link href="/manufacturing/orders">
              <Button variant="outline" className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-8 px-3 hover:border-zinc-500 transition-colors">
                Lihat Semua
              </Button>
            </Link>
          </div>
          {!data.recentOrders?.length ? (
            <div className="text-center py-10 text-zinc-400 text-xs font-bold uppercase tracking-widest">
              Tidak ada work order
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {data.recentOrders.slice(0, 5).map((order, idx) => {
                const cfg = statusLabel(order.status);
                return (
                  <div key={order.id} className={`px-4 py-2.5 flex items-center justify-between gap-2 ${idx % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-800/10'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">{order.number}</span>
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 border whitespace-nowrap ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>
                      <span className="block text-[11px] text-zinc-400 truncate">{order.product}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className={`h-full ${order.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(order.progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black w-8 text-right text-zinc-600 dark:text-zinc-300">{order.progress}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quality Control ──────────────────────────────────────── */}
      <div className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="bg-blue-50 dark:bg-blue-950/20 px-5 py-2.5 border-b-2 border-black flex items-center justify-between border-l-[5px] border-l-blue-400">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-blue-600" />
            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-200">
              Quality Control
            </h3>
          </div>
          <Link href="/manufacturing/quality">
            <Button variant="outline" className="border-2 border-zinc-300 font-bold uppercase text-[10px] tracking-wide h-8 px-3 hover:border-zinc-500 transition-colors">
              Lihat Semua
            </Button>
          </Link>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center p-4 border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
              <p className="text-3xl font-black text-emerald-600">{data.quality.passRate || 0}%</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide mt-1">Pass Rate</p>
            </div>
            <div className="text-center p-4 border-2 border-zinc-300 bg-zinc-50 dark:bg-zinc-800/50">
              <p className="text-3xl font-black text-zinc-900 dark:text-white">{data.quality.totalInspections || 0}</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide mt-1">Total Inspeksi</p>
            </div>
            <div className="text-center p-4 border-2 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20">
              <p className="text-3xl font-black text-emerald-600">{data.quality.passCount || 0}</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide mt-1">Lolos</p>
            </div>
            <div className={`text-center p-4 border-2 ${(data.quality.failCount || 0) > 0 ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : 'border-red-300 bg-red-50 dark:bg-red-950/10'}`}>
              <p className={`text-3xl font-black ${(data.quality.failCount || 0) > 0 ? 'text-red-600' : 'text-red-400'}`}>{data.quality.failCount || 0}</p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wide mt-1">Gagal</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Links ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { href: '/manufacturing/work-centers', icon: Settings, label: 'Work Centers' },
          { href: '/manufacturing/orders', icon: Package, label: 'Work Orders' },
          { href: '/manufacturing/planning', icon: Factory, label: 'Planning' },
          { href: '/manufacturing/bom', icon: Wrench, label: 'Bill of Materials' },
          { href: '/manufacturing/quality', icon: ClipboardCheck, label: 'Quality' },
        ].map((link) => (
          <Link key={link.href} href={link.href}>
            <div className="border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer">
              <div className="p-4 flex items-center gap-3">
                <link.icon className="h-4 w-4 text-blue-500" />
                <span className="font-bold text-xs uppercase tracking-wide">{link.label}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
