"use client"

import { useState } from "react"
import {
  FolderOpen,
  Tag,
  Package,
  Layers,
  Plus,
  Search,
  Filter,
  MoreVertical,
  ChevronRight,
  Archive,
  ArrowRight,
  X,
  Trash2,
  Save
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Mock data structure
const categories = [
  {
    id: "ROOT-001",
    name: "Bahan Baku",
    code: "RAW-MTL",
    itemCount: 450,
    value: 850000000,
    color: "bg-blue-100",
    description: "Raw materials for production including fabrics, threads, and buttons.",
    subs: [
      { name: "Kain (Fabrics)", count: 200 },
      { name: "Benang (Threads)", count: 150 },
      { name: "Kancing (Buttons)", count: 100 },
    ]
  },
  {
    id: "ROOT-002",
    name: "Produk Jadi",
    code: "FIN-GOODS",
    itemCount: 1200,
    value: 1250000000,
    color: "bg-emerald-100",
    description: "Finished goods ready for sale and distribution.",
    subs: [
      { name: "Kemeja (Shirts)", count: 400 },
      { name: "Celana (Pants)", count: 500 },
      { name: "Jaket (Outerwear)", count: 300 },
    ]
  },
  {
    id: "ROOT-003",
    name: "Packaging",
    code: "PCK-MAT",
    itemCount: 5000,
    value: 45000000,
    color: "bg-amber-100",
    description: "Packaging materials for shipping and retail display.",
    subs: [
      { name: "Box Kardus", count: 2000 },
      { name: "Plastic Wrap", count: 3000 },
    ]
  },
  {
    id: "ROOT-004",
    name: "Mesin & Tools",
    code: "MCH-TOOLS",
    itemCount: 45,
    value: 320000000,
    color: "bg-zinc-100",
    description: "Machinery, spare parts, and maintenance tools.",
    subs: [
      { name: "Sparepart Mesin", count: 30 },
      { name: "Oli & Lubricants", count: 15 },
    ]
  },
  {
    id: "ROOT-005",
    name: "Work In Process",
    code: "WIP",
    itemCount: 850,
    value: 120000000,
    color: "bg-purple-100",
    description: "Semi-finished goods currently in production lines.",
    subs: [
      { name: "Cutting Pieces", count: 400 },
      { name: "Sewing Partial", count: 450 },
    ]
  }
]

export default function CategoriesPage() {
  const [selectedCategory, setSelectedCategory] = useState<any>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans">

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black font-serif tracking-tight text-black">Pohon Kategori</h2>
          <p className="text-muted-foreground mt-1 font-medium">Struktur dan klasifikasi aset inventori.</p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide transition-transform active:translate-y-1 active:shadow-none"
        >
          <Plus className="mr-2 h-4 w-4" /> Kategori Baru
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 bg-white p-2 border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search categories..." className="pl-9 border-black focus-visible:ring-black font-medium" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-black font-bold uppercase hover:bg-zinc-100">
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          <Button variant="ghost" size="icon" className="hover:bg-zinc-100">
            <Layers className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat) => (
          <CategoryCard key={cat.id} category={cat} onClick={() => setSelectedCategory(cat)} />
        ))}

        {/* Create Trigger Card */}
        <button
          onClick={() => setIsCreateOpen(true)}
          className="group relative flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 hover:border-black rounded-xl p-8 transition-colors h-full min-h-[300px] bg-zinc-50 hover:bg-white"
        >
          <div className="h-16 w-16 bg-white border border-zinc-200 group-hover:border-black rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all">
            <Plus className="h-8 w-8 text-zinc-400 group-hover:text-black" />
          </div>
          <h3 className="text-lg font-black text-zinc-400 group-hover:text-black uppercase">Buat Kategori Root</h3>
          <p className="text-sm text-zinc-400 font-medium text-center mt-2 max-w-[200px]">Tambahkan klasifikasi utama baru untuk gudang.</p>
        </button>
      </div>

      {/* DIALOGS */}
      <CreateCategoryDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      {selectedCategory && (
        <CategoryDetailDialog
          category={selectedCategory}
          open={!!selectedCategory}
          onOpenChange={(open: boolean) => !open && setSelectedCategory(null)}
        />
      )}

    </div>
  )
}

function CategoryCard({ category, onClick }: { category: any, onClick: () => void }) {
  return (
    <Card
      onClick={onClick}
      className="group relative border border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] transition-all bg-white rounded-xl overflow-hidden flex flex-col cursor-pointer"
    >
      <div className={`h-2 w-full ${category.color} border-b border-black/10`} />

      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <Badge variant="outline" className="border-black text-[10px] font-bold uppercase tracking-wider bg-zinc-50">{category.code}</Badge>
            <CardTitle className="text-2xl font-black uppercase leading-none">{category.name}</CardTitle>
          </div>
          <div className="h-10 w-10 bg-black text-white rounded-lg flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]">
            <FolderOpen className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 flex-1">
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-4 py-2 border-y border-dashed border-zinc-200">
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Total Items</p>
            <p className="text-lg font-black">{category.itemCount.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Est. Value</p>
            <p className="text-lg font-black text-emerald-600">Rp {(category.value / 1000000).toFixed(0)}M</p>
          </div>
        </div>

        {/* Subcategories List */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase flex items-center gap-2">
            <Layers className="h-3 w-3" /> Sub-Categories
          </p>
          <div className="space-y-2">
            {category.subs.map((sub: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between text-sm p-2 bg-zinc-50 border border-black/5 rounded-lg group-hover:bg-white group-hover:border-black/10 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
                  <span className="font-medium text-zinc-700">{sub.name}</span>
                </div>
                <Badge variant="secondary" className="text-[10px] font-bold bg-white border border-black/10">{sub.count}</Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-4 border-t border-black bg-zinc-50">
        <Button variant="ghost" className="w-full justify-between hover:bg-black hover:text-white group/btn transition-all uppercase font-bold text-xs border border-transparent hover:border-black">
          Manage Tree <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
        </Button>
      </CardFooter>
    </Card>
  )
}

function CreateCategoryDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 gap-0 bg-white">
        <DialogHeader className="p-6 border-b border-black bg-zinc-50">
          <DialogTitle className="text-xl font-black uppercase leading-tight flex items-center gap-2">
            <div className="bg-black text-white p-1 rounded-md"><Plus className="h-4 w-4" /></div>
            Create Category
          </DialogTitle>
          <DialogDescription className="text-black/60 font-medium">
            Add a new root or sub-category to the inventory tree.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="uppercase text-xs font-bold text-muted-foreground">Category Name</Label>
              <Input placeholder="e.g. Raw Material" className="border-black focus-visible:ring-black font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="uppercase text-xs font-bold text-muted-foreground">Category Code</Label>
              <Input placeholder="e.g. RAW-001" className="border-black focus-visible:ring-black font-mono" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="uppercase text-xs font-bold text-muted-foreground">Parent Category</Label>
            <Select>
              <SelectTrigger className="border-black focus:ring-black font-medium">
                <SelectValue placeholder="Select Parent (Optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">No Parent (Root Category)</SelectItem>
                <SelectItem value="raw">Bahan Baku</SelectItem>
                <SelectItem value="finish">Produk Jadi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="uppercase text-xs font-bold text-muted-foreground">Description</Label>
            <Textarea placeholder="Describe what items belong here..." className="border-black focus-visible:ring-black min-h-[100px]" />
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-black bg-zinc-50 flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-black font-bold uppercase bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)} className="flex-1 bg-black text-white hover:bg-zinc-800 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
            Create Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryDetailDialog({ category, open, onOpenChange }: { category: any, open: boolean, onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 gap-0 bg-white">
        <DialogHeader className={`p-6 border-b border-black ${category.color}`}>
          <div className="flex justify-between items-start">
            <div>
              <Badge variant="outline" className="border-black bg-white text-black mb-2 shadow-sm">{category.code}</Badge>
              <DialogTitle className="text-3xl font-black uppercase leading-none">{category.name}</DialogTitle>
            </div>
            <div className="h-12 w-12 bg-black text-white flex items-center justify-center rounded-xl shadow-md">
              <FolderOpen className="h-6 w-6" />
            </div>
          </div>
          <DialogDescription className="text-black/70 font-medium mt-2">
            {category.description}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-black rounded-lg bg-zinc-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-xs uppercase font-bold text-muted-foreground">Items in Category</p>
              <p className="text-2xl font-black mt-1">{category.itemCount.toLocaleString()}</p>
            </div>
            <div className="p-4 border border-black rounded-lg bg-zinc-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <p className="text-xs uppercase font-bold text-muted-foreground">Total Valuation</p>
              <p className="text-2xl font-black mt-1 text-emerald-600">Rp {(category.value / 1000000).toLocaleString()}M</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold uppercase text-sm flex items-center gap-2">
                <Layers className="h-4 w-4" /> Sub-Categories Tree
              </h3>
              <Button size="sm" variant="outline" className="h-7 text-xs border-black font-bold uppercase hover:bg-black hover:text-white">
                <Plus className="h-3 w-3 mr-1" /> Add Sub
              </Button>
            </div>
            <div className="border border-black rounded-lg divide-y divide-black/10 overflow-hidden">
              {category.subs.map((sub: any, i: number) => (
                <div key={i} className="p-3 bg-white flex items-center justify-between hover:bg-zinc-50 group">
                  <div className="flex items-center gap-3">
                    <Tag className="h-4 w-4 text-muted-foreground group-hover:text-black" />
                    <span className="font-medium">{sub.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="font-bold border border-black/5">{sub.count} Items</Badge>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-black bg-zinc-50 flex gap-2 justify-between">
          <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold uppercase">
            <Trash2 className="mr-2 h-4 w-4" /> Delete Category
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-black font-bold uppercase bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
              Close
            </Button>
            <Button className="bg-black text-white hover:bg-zinc-800 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
              <Save className="mr-2 h-4 w-4" /> Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}