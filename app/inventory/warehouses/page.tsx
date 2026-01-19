import { Suspense } from 'react'
import {
  Plus,
  MapPin,
  Users,
  LayoutGrid,
  MoreVertical
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

async function WarehouseGrid() {
  const warehouses = await getWarehouses()

  if (warehouses.length === 0) {
    return <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-lg">No Warehouses Found.</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {warehouses.map((wh) => (
        <Card key={wh.id} className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all flex flex-col">
          <CardHeader className="border-b border-black/10 bg-zinc-50 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="border-black font-mono text-xs bg-white text-black line-clamp-1 max-w-[100px]">{wh.id.split('-')[0]}</Badge>
                  <Badge className="bg-black text-white hover:bg-zinc-800">{wh.type}</Badge>
                </div>
                <CardTitle className="text-xl font-black uppercase leading-tight line-clamp-1" title={wh.name}>{wh.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1 text-xs font-medium">
                  <MapPin className="h-3 w-3" /> {wh.location}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-black hover:text-white rounded-full">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 flex-1 space-y-6">

            {/* Capacity Meter */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold uppercase">
                <span>Used Capacity</span>
                <span className={wh.capacity > 80 ? "text-red-600" : "text-emerald-600"}>{wh.capacity}%</span>
              </div>
              <Progress value={wh.capacity} className="h-3 border border-black/10 bg-zinc-100" indicatorClassName={wh.capacity > 80 ? "bg-red-600" : "bg-black"} />
              <p className="text-[10px] text-muted-foreground mt-1 text-right">{wh.items.toLocaleString()} Items Stored</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border border-black/10 rounded-lg bg-zinc-50/50">
                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase">Manager</span>
                </div>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6 border border-black/20">
                    <AvatarFallback className="text-[10px] bg-white text-black font-bold">M</AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold leading-none truncate">{wh.manager}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{wh.phone}</p>
                  </div>
                </div>
              </div>
              <div className="p-3 border border-black/10 rounded-lg bg-zinc-50/50 flex flex-col justify-center items-center text-center">
                <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Active Staff</p>
                <p className="text-2xl font-black">{wh.staff}</p>
              </div>
            </div>

          </CardContent>
          <CardFooter className="pt-4 border-t border-black/5 bg-zinc-50">
            <Button asChild variant="outline" className="w-full border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] uppercase font-bold text-xs h-9 cursor-pointer">
              <Link href={`/inventory/warehouses/${wh.id}`}>
                <LayoutGrid className="mr-2 h-3.5 w-3.5" />
                View Categories & Layout
              </Link>
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

export default function WarehousesPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black font-serif tracking-tight">Manajemen Gudang</h2>
          <p className="text-muted-foreground mt-1">Daftar lokasi penyimpanan dan kapasitas.</p>
        </div>
        <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
          <Plus className="mr-2 h-4 w-4" /> Tambah Gudang
        </Button>
      </div>

      <Suspense fallback={<div className="h-96 w-full animate-pulse bg-slate-100 rounded-xl" />}>
        <WarehouseGrid />
      </Suspense>
    </div>
  );
}