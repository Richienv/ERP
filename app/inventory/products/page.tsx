"use client"

import * as React from "react"
import { KanbanBoard, KanbanColumn, KanbanTask } from "@/components/ui/trello-kanban-board"
import { Button } from "@/components/ui/button"
import { Plus, X, Search, Filter } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

// Mock data for products flow
const productColumns: KanbanColumn[] = [
  {
    id: "draft",
    title: "Konsep / Draf",
    tasks: [
      { id: "p-1", title: "Winter Jacket Prototype", description: "Needs material selection", labels: ["design"] },
      { id: "p-2", title: "Silk Scarf V2", labels: ["research"] },
    ],
  },
  {
    id: "sourcing",
    title: "Pencarian Bahan",
    tasks: [
      { id: "p-3", title: "Denim Jeans 501", description: "Waiting for supplier confirmation on denim rolls.", labels: ["urgent", "procurement"] },
      { id: "p-4", title: "Cotton T-Shirt Basic", assignee: "Budi" },
    ],
  },
  {
    id: "production",
    title: "Dalam Produksi",
    tasks: [
      { id: "p-5", title: "Linen Shirt Summer", description: "Cutting phase complete, moving to sewing.", labels: ["production"] },
    ],
  },
  {
    id: "quality-control",
    title: "Kontrol Kualitas",
    tasks: [
      { id: "p-6", title: "Velvet Dress", assignee: "Siti" },
    ],
  },
  {
    id: "ready",
    title: "Stok Siap",
    tasks: [
      { id: "p-7", title: "Chino Pants Tan", labels: ["stock"] },
      { id: "p-8", title: "Polo Shirt Navy", labels: ["stock"] },
    ],
  },
]

export default function ProductsKanbanPage() {
  const [selectedTask, setSelectedTask] = React.useState<KanbanTask | null>(null)
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)

  const handleTaskClick = (task: KanbanTask) => {
    setSelectedTask(task)
    setIsSheetOpen(true)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] bg-white p-4 md:p-8 space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black font-serif tracking-tight text-black">Kelola Produk</h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Lacak siklus produk dari konsep hingga siap stok.
          </p>
        </div>
        <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
          <Plus className="mr-2 h-4 w-4" />
          Produk Baru
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search Products..." className="pl-9 border-black focus-visible:ring-black" />
        </div>
        <Button variant="outline" className="border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
          <Filter className="h-4 w-4 mr-2" /> Filter
        </Button>
      </div>

      <div className="flex-1 overflow-hidden p-1">
        <KanbanBoard
          columns={productColumns}
          columnColors={{
            draft: "bg-zinc-100 border-t-4 border-t-zinc-600",
            sourcing: "bg-amber-50 border-t-4 border-t-amber-600",
            production: "bg-blue-50 border-t-4 border-t-blue-600",
            "quality-control": "bg-purple-50 border-t-4 border-t-purple-600",
            ready: "bg-emerald-50 border-t-4 border-t-emerald-600"
          }}
          labelColors={{
            design: "bg-pink-100 text-pink-700 border border-pink-200",
            research: "bg-violet-100 text-violet-700 border border-violet-200",
            urgent: "bg-rose-100 text-rose-700 border border-rose-200",
            procurement: "bg-amber-100 text-amber-700 border border-amber-200",
            production: "bg-blue-100 text-blue-700 border border-blue-200",
            stock: "bg-emerald-100 text-emerald-700 border border-emerald-200"
          }}
          className="h-full gap-6"
          onTaskClick={handleTaskClick}
        />
      </div>

      {/* Task Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md border-l border-black bg-white">
          <SheetHeader className="mb-6 border-b border-black/10 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="border-black font-mono text-xs px-2 py-0.5 rounded-none">{selectedTask?.id}</Badge>
            </div>
            <SheetTitle className="text-2xl font-black font-serif uppercase tracking-tight">{selectedTask?.title}</SheetTitle>
            <SheetDescription className="font-medium text-muted-foreground">
              Product Management Detail
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="uppercase text-xs font-black text-muted-foreground">Title</Label>
              <Input id="title" defaultValue={selectedTask?.title} className="border-black focus-visible:ring-black font-bold text-lg" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc" className="uppercase text-xs font-black text-muted-foreground">Description</Label>
              <Textarea
                id="desc"
                defaultValue={selectedTask?.description || ""}
                placeholder="Add product details..."
                className="border-black min-h-[120px] focus-visible:ring-black"
              />
            </div>

            <div className="space-y-2">
              <Label className="uppercase text-xs font-black text-muted-foreground">Labels</Label>
              <div className="flex flex-wrap gap-2">
                {selectedTask?.labels?.map(label => (
                  <Badge key={label} variant="outline" className="border-black bg-white text-black hover:bg-black hover:text-white transition-colors cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    {label}
                  </Badge>
                ))}
                <Button variant="outline" size="sm" className="h-6 border-black text-xs hover:bg-black hover:text-white uppercase font-bold">
                  <Plus className="h-3 w-3 mr-1" /> Add Label
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignee" className="uppercase text-xs font-black text-muted-foreground">Assignee</Label>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-black bg-zinc-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <div className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold border border-black">
                  {selectedTask?.assignee?.substring(0, 2) || "?"}
                </div>
                <span className="font-bold">{selectedTask?.assignee || "Unassigned"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-8 pt-6 border-t border-black">
            <Button className="w-full bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold text-lg h-12">Save Changes</Button>
            <Button variant="outline" className="w-full border-black font-bold uppercase hover:bg-zinc-100" onClick={() => setIsSheetOpen(false)}>
              Cancel
            </Button>
          </div>

        </SheetContent>
      </Sheet>
    </div>
  )
}