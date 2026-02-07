"use client";

import { useEffect, useState } from "react";
import {
  Factory,
  AlertTriangle,
  CheckCircle,
  Activity,
  Settings,
  Package,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Gauge,
  ClipboardCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function ManufacturingDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/manufacturing/dashboard');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const getOEEColor = (oee: number) => {
    if (oee >= 85) return 'text-emerald-600';
    if (oee >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black font-serif tracking-tight">Manufacturing Dashboard</h2>
          <p className="text-muted-foreground">Overview produksi dan status pabrik real-time.</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={fetchDashboard}
          disabled={loading}
          className="border-black"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={fetchDashboard} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {!loading && data?.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, i) => (
            <Card key={i} className={`border ${alert.type === 'error' ? 'border-red-500 bg-red-50' :
                alert.type === 'warning' ? 'border-amber-500 bg-amber-50' :
                  'border-blue-500 bg-blue-50'
              }`}>
              <CardContent className="p-3 flex items-center gap-3">
                {alert.type === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                )}
                <div>
                  <p className="font-bold text-sm">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* OEE & Production Health */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {loading ? (
          <>
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-20 mb-4" />
                  <Skeleton className="h-16 w-16 rounded-full mx-auto" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            {/* OEE Card */}
            <Card className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
              <CardContent className="p-6 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Overall OEE</p>
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-zinc-700"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={251.2}
                      strokeDashoffset={251.2 - (251.2 * (data?.productionHealth.oee || 0)) / 100}
                      className={
                        (data?.productionHealth.oee || 0) >= 85 ? 'text-emerald-400' :
                          (data?.productionHealth.oee || 0) >= 60 ? 'text-amber-400' : 'text-red-400'
                      }
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-3xl font-black">{data?.productionHealth.oee || 0}%</span>
                </div>
                <p className="text-xs text-zinc-400 mt-2">Target: 85%</p>
              </CardContent>
            </Card>

            {/* Availability */}
            <OEEMetricCard
              label="Availability"
              value={data?.productionHealth.availability || 0}
              icon={Activity}
              description="Machine uptime"
            />

            {/* Performance */}
            <OEEMetricCard
              label="Performance"
              value={data?.productionHealth.performance || 0}
              icon={TrendingUp}
              description="Production speed"
            />

            {/* Quality */}
            <OEEMetricCard
              label="Quality"
              value={data?.productionHealth.quality || 0}
              icon={CheckCircle}
              description="First pass yield"
            />
          </>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {loading ? (
          <>
            {[1, 2, 3, 4, 5].map(i => (
              <Card key={i} className="border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard label="Total Orders" value={data?.workOrders.total || 0} icon={Package} />
            <StatCard label="In Progress" value={data?.workOrders.inProgress || 0} icon={Factory} color="text-yellow-600" />
            <StatCard label="Completed" value={data?.workOrders.completedThisMonth || 0} icon={CheckCircle} color="text-emerald-600" />
            <StatCard label="Active Machines" value={`${data?.machines.running || 0}/${data?.machines.total || 0}`} icon={Settings} />
            <StatCard label="Pass Rate" value={`${data?.quality.passRate || 0}%`} icon={ClipboardCheck} color="text-blue-600" />
          </>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Machine Status */}
        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="border-b border-black/10 bg-zinc-50 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
              <Settings className="h-5 w-5" /> Machine Status
            </CardTitle>
            <Link href="/manufacturing/work-centers">
              <Button variant="ghost" size="sm" className="text-xs">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-4">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-2xl font-black text-emerald-600">{data?.machines.running || 0}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Running</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                  <p className="text-2xl font-black text-zinc-600">{data?.machines.idle || 0}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Idle</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-2xl font-black text-amber-600">{data?.machines.maintenance || 0}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Maint.</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-2xl font-black text-red-600">{data?.machines.breakdown || 0}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Down</p>
                </div>
              </div>
            )}

            {!loading && data && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Average Health</span>
                  <span className="font-bold">{data.machines.avgHealth}%</span>
                </div>
                <Progress
                  value={data.machines.avgHealth}
                  className="h-2 bg-zinc-100"
                  indicatorClassName={
                    data.machines.avgHealth >= 80 ? 'bg-emerald-500' :
                      data.machines.avgHealth >= 60 ? 'bg-amber-500' : 'bg-red-500'
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader className="border-b border-black/10 bg-zinc-50 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
              <Package className="h-5 w-5" /> Recent Orders
            </CardTitle>
            <Link href="/manufacturing/orders">
              <Button variant="ghost" size="sm" className="text-xs">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !data?.recentOrders?.length ? (
              <div className="p-8 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No recent orders</p>
              </div>
            ) : (
              <div className="divide-y divide-black/10">
                {data.recentOrders.slice(0, 4).map((order) => (
                  <div key={order.id} className="p-3 hover:bg-zinc-50 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <p className="font-bold font-mono text-sm">{order.number}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{order.product}</p>
                      </div>
                      <Badge
                        className={`text-[10px] ${order.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                            order.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-zinc-100 text-zinc-600'
                          } border-black`}
                      >
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={order.progress}
                        className="h-1.5 flex-1 bg-zinc-100"
                        indicatorClassName={order.progress >= 100 ? 'bg-emerald-500' : 'bg-black'}
                      />
                      <span className="text-xs font-bold w-8">{order.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quality Section */}
      <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardHeader className="border-b border-black/10 bg-zinc-50 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> Quality Control
          </CardTitle>
          <Link href="/manufacturing/quality">
            <Button variant="ghost" size="sm" className="text-xs">View All</Button>
          </Link>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-3xl font-black text-emerald-600">{data?.quality.passRate || 0}%</p>
                <p className="text-xs font-bold text-muted-foreground uppercase">Pass Rate</p>
              </div>
              <div className="text-center p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                <p className="text-3xl font-black">{data?.quality.totalInspections || 0}</p>
                <p className="text-xs font-bold text-muted-foreground uppercase">Total Inspections</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-3xl font-black text-emerald-600">{data?.quality.passCount || 0}</p>
                <p className="text-xs font-bold text-muted-foreground uppercase">Passed</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-3xl font-black text-red-600">{data?.quality.failCount || 0}</p>
                <p className="text-xs font-bold text-muted-foreground uppercase">Failed</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <QuickLink href="/manufacturing/work-centers" icon={Settings} label="Work Centers" />
        <QuickLink href="/manufacturing/orders" icon={Package} label="Orders" />
        <QuickLink href="/manufacturing/planning" icon={Factory} label="Planning" />
        <QuickLink href="/manufacturing/bom" icon={Users} label="Bill of Materials" />
        <QuickLink href="/manufacturing/quality" icon={ClipboardCheck} label="Quality" />
      </div>
    </div>
  );
}

function OEEMetricCard({ label, value, icon: Icon, description }: { label: string; value: number; icon: any; description: string }) {
  const getColor = (v: number) => {
    if (v >= 85) return 'text-emerald-600';
    if (v >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <CardContent className="p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
        <p className={`text-4xl font-black ${getColor(value)}`}>{value}%</p>
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon: Icon, color = "text-black" }: { label: string; value: string | number; icon: any; color?: string }) {
  return (
    <Card className="border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-black ${color}`}>{value}</p>
        </div>
        <Icon className={`h-6 w-6 opacity-20 ${color}`} />
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Link href={href}>
      <Card className="border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer">
        <CardContent className="p-4 flex items-center gap-3">
          <Icon className="h-5 w-5" />
          <span className="font-bold text-sm">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}