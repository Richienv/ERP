"use client"

import * as React from "react"
import { KanbanBoard, KanbanColumn, KanbanTask } from "@/components/ui/trello-kanban-board"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
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
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] bg-black p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-white font-serif">Kelola Produk</h1>
          <p className="text-zinc-400 mt-1">
            Lacak siklus produk dari konsep hingga siap stok.
          </p>
        </div>
        <Button className="bg-white text-black hover:bg-zinc-200">
          <Plus className="mr-2 h-4 w-4" />
          Produk Baru
        </Button>
      </div>

      <div className="flex-1 overflow-hidden rounded-3xl bg-zinc-900/50 border border-zinc-800 p-6">
        <KanbanBoard
          columns={productColumns}
          columnColors={{
            draft: "bg-zinc-500",
            sourcing: "bg-amber-600",
            production: "bg-blue-600",
            "quality-control": "bg-purple-600",
            ready: "bg-emerald-600"
          }}
          labelColors={{
            design: "bg-pink-500",
            research: "bg-violet-500",
            urgent: "bg-rose-500",
            procurement: "bg-amber-500",
            production: "bg-blue-500",
            stock: "bg-emerald-500"
          }}
          className="h-full"
          onTaskClick={handleTaskClick}
        />
      </div>

      {/* Task Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-md">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-serif">{selectedTask?.title}</SheetTitle>
            <SheetDescription className="text-zinc-400">
              Product ID: {selectedTask?.id}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-zinc-400">Title</Label>
              <Input id="title" defaultValue={selectedTask?.title} className="bg-zinc-900 border-zinc-800 focus-visible:ring-indigo-500" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc" className="text-zinc-400">Description</Label>
              <Textarea
                id="desc"
                defaultValue={selectedTask?.description || ""}
                placeholder="Add product details..."
                className="bg-zinc-900 border-zinc-800 min-h-[120px] focus-visible:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-400">Labels</Label>
              <div className="flex flex-wrap gap-2">
                {selectedTask?.labels?.map(label => (
                  <Badge key={label} variant="outline" className="border-zinc-700 bg-zinc-900 text-zinc-300">
                    {label}
                  </Badge>
                ))}
                <Button variant="outline" size="sm" className="h-6 border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Add Label
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignee" className="text-zinc-400">Assignee</Label>
              <div className="flex items-center gap-2 p-2 rounded-md border border-zinc-800 bg-zinc-900">
                <div className="h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold border border-indigo-500/30">
                  {selectedTask?.assignee?.substring(0, 2) || "?"}
                </div>
                <span className="text-sm">{selectedTask?.assignee || "Unassigned"}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <Button className="flex-1 bg-white text-black hover:bg-zinc-200">Save Changes</Button>
            <Button variant="outline" className="border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white" onClick={() => setIsSheetOpen(false)}>
              Cancel
            </Button>
          </div>

        </SheetContent>
      </Sheet>
    </div>
  )
}