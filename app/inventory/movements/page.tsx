"use client";

import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Calendar,
  Filter,
  Download
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

const MOVEMENTS = [
  { id: "MV-001", type: "IN", item: "Denim Fabric 13oz", qty: 500, unit: "Meters", from: "Supplier (PT. Tekstil Jaya)", to: "Gudang A - Rack 04", date: "Today, 10:30", user: "Budi S." },
  { id: "MV-002", type: "OUT", item: "YKK Zippers", qty: 200, unit: "Pcs", from: "Gudang A", to: "Production Line 1", date: "Today, 09:15", user: "Siti A." },
  { id: "MV-003", type: "TRANSFER", item: "Chino Pants (WIP)", qty: 100, unit: "Pcs", from: "Sewing", to: "Finishing", date: "Today, 08:45", user: "Joko" },
  { id: "MV-004", type: "OUT", item: "Cotton Thread White", qty: 50, unit: "Spools", from: "Gudang A", to: "Production Line 2", date: "Yesterday", user: "Rina" },
  { id: "MV-005", type: "IN", item: "Packaging Boxes", qty: 1000, unit: "Pcs", from: "Supplier (Boxindo)", to: "Gudang B", date: "Yesterday", user: "Budi S." },
];

export default function StockMovementsPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black font-serif tracking-tight">Pergerakan Stok</h2>
          <p className="text-muted-foreground mt-1">Riwayat keluar masuk barang dan transfer internal.</p>
        </div>
        <Button className="bg-white text-black hover:bg-zinc-100 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
          <Download className="mr-2 h-4 w-4" /> Export Log
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Summary Cards */}
        <div className="bg-emerald-50 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-emerald-800">Total Inbound (Today)</p>
            <h3 className="text-3xl font-black text-emerald-900 mt-1">1,500 <span className="text-sm font-medium">Items</span></h3>
          </div>
          <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center border border-black">
            <ArrowDownRight className="h-6 w-6 text-emerald-700" />
          </div>
        </div>
        <div className="bg-blue-50 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-blue-800">Total Outbound (Today)</p>
            <h3 className="text-3xl font-black text-blue-900 mt-1">250 <span className="text-sm font-medium">Items</span></h3>
          </div>
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center border border-black">
            <ArrowUpRight className="h-6 w-6 text-blue-700" />
          </div>
        </div>
        <div className="bg-purple-50 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-purple-800">Internal Transfers</p>
            <h3 className="text-3xl font-black text-purple-900 mt-1">12 <span className="text-sm font-medium">Moves</span></h3>
          </div>
          <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center border border-black">
            <ArrowRightLeft className="h-6 w-6 text-purple-700" />
          </div>
        </div>
      </div>

      {/* Main Log Table */}
      <Card className="border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden mt-6">
        <CardHeader className="bg-zinc-50 border-b border-black">
          <div className="flex items-center justify-between">
            <CardTitle className="uppercase font-black text-lg">Transaction Log</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="border-black shadow-sm font-bold"><Calendar className="h-4 w-4 mr-2" /> Date Range</Button>
              <Button variant="outline" size="sm" className="border-black shadow-sm font-bold"><Filter className="h-4 w-4 mr-2" /> Filter Type</Button>
            </div>
          </div>
        </CardHeader>
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[100px] font-bold text-black uppercase text-xs">ID</TableHead>
                <TableHead className="w-[100px] font-bold text-black uppercase text-xs">Type</TableHead>
                <TableHead className="font-bold text-black uppercase text-xs">Item</TableHead>
                <TableHead className="font-bold text-black uppercase text-xs">Quantity</TableHead>
                <TableHead className="font-bold text-black uppercase text-xs">From / To</TableHead>
                <TableHead className="font-bold text-black uppercase text-xs">Date / User</TableHead>
                <TableHead className="text-right font-bold text-black uppercase text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOVEMENTS.map((mv) => (
                <TableRow key={mv.id} className="cursor-pointer hover:bg-zinc-50">
                  <TableCell className="font-mono text-xs font-bold text-muted-foreground">{mv.id}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`border-black shadow-sm font-bold uppercase text-[10px] w-20 justify-center ${mv.type === 'IN' ? 'bg-emerald-100 text-emerald-800' :
                          mv.type === 'OUT' ? 'bg-blue-100 text-blue-800' :
                            'bg-purple-100 text-purple-800'
                        }`}
                    >
                      {mv.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold">{mv.item}</TableCell>
                  <TableCell>
                    <span className={`font-black ${mv.type === 'IN' ? 'text-emerald-700' : 'text-blue-700'}`}>
                      {mv.type === 'IN' ? '+' : '-'}{mv.qty}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">{mv.unit}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">From: <strong className="text-foreground">{mv.from}</strong></span>
                      <span className="text-muted-foreground">To: <strong className="text-foreground">{mv.to}</strong></span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col">
                      <span className="font-bold">{mv.date}</span>
                      <span className="text-muted-foreground">By {mv.user}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-black hover:text-white rounded-full"><ArrowUpRight className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}