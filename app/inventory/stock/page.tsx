"use client";

import {
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Package,
  LayoutGrid,
  List
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

const STOCK_ITEMS = [
  { id: "MAT-001", name: "Denim Fabric 13oz", category: "Raw Material", location: "Gudang A - Rack 04", qty: 1250, unit: "Meters", min: 500, max: 2000, status: "Healthy" },
  { id: "MAT-002", name: "YKK Zippers (Metal)", category: "Accessories", location: "Gudang A - Bin 12", qty: 120, unit: "Pcs", min: 200, max: 1000, status: "Low" },
  { id: "PRD-201", name: "Chino Pants (Tan) 32", category: "Finish Goods", location: "Gudang B - Zone C", qty: 45, unit: "Pcs", min: 50, max: 300, status: "Critical" },
  { id: "PRD-202", name: "Denim Jacket V2 (L)", category: "Finish Goods", location: "Gudang B - Zone A", qty: 350, unit: "Pcs", min: 100, max: 500, status: "Healthy" },
  { id: "WIP-105", name: "Cut Pieces (Shirt)", category: "WIP", location: "Floor 2 - Line A", qty: 880, unit: "Pcs", min: 0, max: 0, status: "Normal" },
];

export default function StockLevelPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black font-serif tracking-tight">Level Stok</h2>
          <p className="text-muted-foreground mt-1">Real-time monitoring persediaan dan status ketersediaan.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none transition-all">
            <AlertTriangle className="mr-2 h-4 w-4" /> Stock Alerts (2)
          </Button>
          <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
            <Package className="mr-2 h-4 w-4" /> Stock Opname
          </Button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="uppercase text-xs font-bold text-muted-foreground">Total Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight">Rp 2.45 Miliar</div>
            <div className="flex items-center text-xs font-bold text-emerald-600 mt-1">
              <ArrowUpRight className="h-3 w-3 mr-1" /> +12% vs last month
            </div>
          </CardContent>
        </Card>
        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="uppercase text-xs font-bold text-muted-foreground">Items Below Minimum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight text-red-600">14 Items</div>
            <div className="flex items-center text-xs font-bold text-red-600 mt-1">
              Action required primarily on Accessories
            </div>
          </CardContent>
        </Card>
        <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="uppercase text-xs font-bold text-muted-foreground">Stock Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight text-blue-600">94%</div>
            <Progress value={94} className="h-2 mt-2 bg-zinc-100 border border-black/10" indicatorClassName="bg-blue-600" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-zinc-50 p-3 rounded-xl border border-black shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search SKU, Name..." className="pl-9 border-black focus-visible:ring-black" />
        </div>
        <div className="flex gap-2">
          {['All', 'Raw Material', 'WIP', 'Finish Goods', 'Accessories'].map((filter) => (
            <Button key={filter} variant="ghost" size="sm" className="font-bold text-muted-foreground hover:text-black hover:bg-black/5">{filter}</Button>
          ))}
        </div>
        <div className="ml-auto flex gap-2 border-l border-black/10 pl-4">
          <Button size="icon" variant="ghost"><LayoutGrid className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="bg-black text-white hover:bg-zinc-800"><List className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader className="bg-zinc-100 border-b border-black">
            <TableRow>
              <TableHead className="font-bold text-black uppercase text-xs w-[100px]">SKU</TableHead>
              <TableHead className="font-bold text-black uppercase text-xs">Product Name</TableHead>
              <TableHead className="font-bold text-black uppercase text-xs">Category</TableHead>
              <TableHead className="font-bold text-black uppercase text-xs">Location</TableHead>
              <TableHead className="font-bold text-black uppercase text-xs text-right">Qty</TableHead>
              <TableHead className="font-bold text-black uppercase text-xs">Status</TableHead>
              <TableHead className="font-bold text-black uppercase text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STOCK_ITEMS.map((item) => (
              <TableRow key={item.id} className="cursor-pointer hover:bg-zinc-50">
                <TableCell className="font-mono text-xs font-bold text-muted-foreground">{item.id}</TableCell>
                <TableCell>
                  <span className="font-bold block">{item.name}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-black/20 text-muted-foreground text-[10px] uppercase">{item.category}</Badge>
                </TableCell>
                <TableCell className="text-xs font-medium">{item.location}</TableCell>
                <TableCell className="text-right">
                  <span className="font-black text-lg">{item.qty.toLocaleString()}</span> <span className="text-xs text-muted-foreground">{item.unit}</span>
                </TableCell>
                <TableCell>
                  {item.status === 'Critical' ? (
                    <Badge variant="destructive" className="uppercase font-bold text-[10px] border-black shadow-sm animate-pulse">Critical</Badge>
                  ) : item.status === 'Low' ? (
                    <Badge className="bg-amber-100 text-amber-800 border-black hover:bg-amber-200 uppercase font-bold text-[10px]">Low Stock</Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 uppercase font-bold text-[10px]">{item.status}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" className="h-7 text-[10px] uppercase font-bold border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]">History</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}