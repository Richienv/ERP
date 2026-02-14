import {
  Plus,
  MapPin,
  Users,
  LayoutGrid,
  MoreVertical,
  Warehouse,
  Package,
  Boxes,
  Activity,
  UserCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from 'next/link'
import { getWarehouses } from "@/app/actions/inventory";
import { WarehouseFormDialog } from "@/components/inventory/warehouse-form-dialog";
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider";
import { WarehouseStaffDialog } from "@/components/inventory/warehouse-staff-dialog";

export const dynamic = 'force-dynamic'

/** Race a promise against a timeout — returns fallback on timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ])
}

async function WarehouseGrid() {
  const warehouses = await withTimeout(getWarehouses(), 8000, [])

  // Aggregate Stats
  const stats = {
    total: warehouses.length,
    active: warehouses.filter(w => w.status === 'Active').length,
    totalItems: warehouses.reduce((acc, w) => acc + (w.items || 0), 0),
    avgUtilization: warehouses.length > 0
      ? Math.round(warehouses.reduce((acc, w) => acc + (w.utilization || 0), 0) / warehouses.length)
      : 0,
    totalStaff: warehouses.reduce((acc, w) => acc + (w.staff || 0), 0)
  }

  return (
    <div className="space-y-4">

      {/* ═══════════════════════════════════════════ */}
      {/* COMMAND HEADER                              */}
      {/* ═══════════════════════════════════════════ */}
      <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900 rounded-none">
        <div className="px-6 py-4 flex items-center justify-between border-l-[6px] border-l-amber-400">
          <div className="flex items-center gap-3">
            <Warehouse className="h-5 w-5 text-amber-500" />
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Manajemen Gudang
              </h1>
              <p className="text-zinc-400 text-xs font-medium mt-0.5">
                Monitor lokasi penyimpanan, utilisasi, dan staff gudang
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WarehouseFormDialog
              mode="create"
              trigger={
                <Button className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-bold text-[10px] tracking-wide hover:translate-y-[1px] hover:shadow-none transition-all px-4 h-9 rounded-none">
                  <Plus className="mr-2 h-3.5 w-3.5" /> Tambah Gudang
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* KPI PULSE STRIP                            */}
      {/* ═══════════════════════════════════════════ */}
      <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden rounded-none">
        <div className="grid grid-cols-2 md:grid-cols-4">

          {/* Total Warehouses */}
          <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />
            <div className="flex items-center gap-2 mb-2">
              <Warehouse className="h-4 w-4 text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Gudang</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-amber-600">
              {stats.total}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[10px] font-bold text-amber-600">{stats.active} Aktif</span>
            </div>
          </div>

          {/* Average Utilization */}
          <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-violet-400" />
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Avg. Utilisasi</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-violet-600">
              {stats.avgUtilization}%
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <Progress value={stats.avgUtilization} className="h-1.5 w-16 bg-violet-100 rounded-none" indicatorClassName="bg-violet-500" />
            </div>
          </div>

          {/* Total Items Stored */}
          <div className="relative p-4 md:p-5 md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-400" />
            <div className="flex items-center gap-2 mb-2">
              <Boxes className="h-4 w-4 text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Item Disimpan</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-blue-600">
              {(stats.totalItems / 1000).toFixed(1)}k
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[10px] font-bold text-blue-600">Unit total</span>
            </div>
          </div>

          {/* Total Staff */}
          <div className="relative p-4 md:p-5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-400" />
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-4 w-4 text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Staff</span>
            </div>
            <div className="text-2xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-white">
              {stats.totalStaff}
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[10px] font-bold text-zinc-400">Pegawai aktif</span>
            </div>
          </div>

        </div>
      </div>

      {warehouses.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground border-2 border-dashed border-zinc-300 rounded-none bg-zinc-50">
          <Warehouse className="h-10 w-10 mx-auto text-zinc-300 mb-2" />
          <p className="font-bold">Belum ada gudang terdaftar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((wh) => (
            <Card key={wh.id} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex flex-col rounded-none overflow-hidden group bg-white dark:bg-zinc-900">

              {/* Card Header */}
              <div className="border-b-2 border-black bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="border-black font-mono text-[10px] font-bold bg-white text-black h-5 px-1.5 rounded-none">
                      {wh.code}
                    </Badge>
                    <Badge className="bg-black text-white hover:bg-zinc-800 h-5 px-1.5 text-[9px] font-black uppercase rounded-none tracking-wider">
                      {wh.type}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-black uppercase leading-tight line-clamp-1 group-hover:text-amber-600 transition-colors" title={wh.name}>
                    {wh.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                    <MapPin className="h-3 w-3" /> {wh.location}
                  </div>
                </div>

                <WarehouseFormDialog
                  mode="edit"
                  warehouse={{
                    id: wh.id,
                    name: wh.name,
                    code: wh.code,
                    address: wh.location,
                    capacity: wh.capacity
                  }}
                  trigger={
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-black hover:text-white rounded-none -mr-1">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              </div>

              <CardContent className="pt-5 flex-1 space-y-5 px-4 pb-5">
                {/* Capacity Meter */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-wide text-zinc-500">
                    <span>Kapasitas ({wh.capacity > 85 ? 'Penuh' : 'Tersedia'})</span>
                    <span className={wh.capacity > 85 ? "text-red-600" : "text-emerald-600"}>{wh.capacity}%</span>
                  </div>
                  <Progress
                    value={wh.capacity}
                    className="h-2.5 border-2 border-black/10 bg-zinc-100 rounded-none"
                    indicatorClassName={wh.capacity > 85 ? "bg-red-500" : "bg-black"}
                  />
                  <p className="text-[10px] font-mono text-zinc-400 text-right font-bold mt-0.5">
                    {wh.items.toLocaleString()} / {wh.capacity.toLocaleString()} Units
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 border border-zinc-200 rounded-none bg-zinc-50/50">
                    <div className="flex items-center gap-1.5 mb-2 text-zinc-400">
                      <Users className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-wider">Manager</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 border border-zinc-200 rounded-none">
                        <AvatarFallback className="text-[9px] bg-white text-black font-black rounded-none">
                          {wh.manager.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold leading-none truncate">{wh.manager}</p>
                        <p className="text-[9px] text-zinc-400 mt-0.5 truncate">{wh.phone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center p-2.5 border border-zinc-200 rounded-none bg-zinc-50/50">
                    <WarehouseStaffDialog warehouseId={wh.id} warehouseName={wh.name} triggerMode="staff" />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-3 pb-4 px-4 border-t-2 border-black bg-zinc-50/50 flex gap-2">
                <Button asChild variant="default" className="flex-1 bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-zinc-50 hover:shadow-none hover:translate-y-[1px] uppercase font-black text-[10px] tracking-wider h-8 rounded-none">
                  <Link href={`/inventory/warehouses/${wh.id}`}>
                    <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                    Detail Gudang
                  </Link>
                </Button>
                <div className="shrink-0">
                  <WarehouseStaffDialog warehouseId={wh.id} warehouseName={wh.name} triggerMode="manager" />
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default async function WarehousesPage() {
  return (
    <InventoryPerformanceProvider currentPath="/inventory/warehouses">
      <div className="p-4 md:p-8 pt-6 max-w-[1600px] mx-auto min-h-screen">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <WarehouseGrid />
        </div>
      </div>
    </InventoryPerformanceProvider>
  )
}
