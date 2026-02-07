"use client"

import { useState, useMemo } from "react"
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
import { createCategory } from "@/app/actions/inventory"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface CategoryWithChildren {
    id: string
    name: string
    code: string
    description: string | null
    parentId: string | null
    children: any[] // Recursive type in validation
    _count: { products: number }
}

interface CategoriesClientProps {
    categories: CategoryWithChildren[]
    allCategories: { id: string, name: string }[] // For dropdown
}

export function CategoriesClient({ categories, allCategories }: CategoriesClientProps) {
    const [selectedCategory, setSelectedCategory] = useState<any>(null)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const router = useRouter()

    // Map flat/nested Prisma structure to UI structure
    // Prisma returns children nested if we used include: { children: true }
    // But if we just got a flat list, we'd need to build tree.
    // The server action getAllCategories returns objects WITH children array.

    const uiCategories = useMemo(() => {
        // Filter only Root categories (parentId === null) for the main grid
        return categories.filter(c => !c.parentId).map(cat => ({
            ...cat,
            itemCount: cat._count.products,
            // Prisma children might not have _count if we didn't include it deeply
            // For now let's just show direct children
            subs: cat.children.map((child: any) => ({
                name: child.name,
                // We might not have count for children unless fetched deep
                count: 0
            })),
            value: 0, // We don't have value calc yet
            color: "bg-blue-100" // Default color
        }))
    }, [categories])

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
                {uiCategories.map((cat) => (
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
            <CreateCategoryDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                parents={allCategories}
                onSuccess={() => {
                    router.refresh()
                    setIsCreateOpen(false)
                }}
            />
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
                        <p className="text-lg font-black text-emerald-600">--</p>
                    </div>
                </div>

                {/* Subcategories List */}
                <div className="space-y-3">
                    <p className="text-xs font-bold uppercase flex items-center gap-2">
                        <Layers className="h-3 w-3" /> Sub-Categories
                    </p>
                    <div className="space-y-2">
                        {category.subs && category.subs.length > 0 ? category.subs.map((sub: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm p-2 bg-zinc-50 border border-black/5 rounded-lg group-hover:bg-white group-hover:border-black/10 transition-colors">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
                                    <span className="font-medium text-zinc-700">{sub.name}</span>
                                </div>
                                <Badge variant="secondary" className="text-[10px] font-bold bg-white border border-black/10">{sub.count}</Badge>
                            </div>
                        )) : (
                            <p className="text-xs text-muted-foreground italic">No subcategories</p>
                        )}
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

interface CreateCategoryDialogProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    parents: { id: string, name: string }[]
    onSuccess: () => void
}

function CreateCategoryDialog({ open, onOpenChange, parents, onSuccess }: CreateCategoryDialogProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        const formData = new FormData(e.currentTarget)
        const data = {
            name: formData.get("name") as string,
            code: formData.get("code") as string,
            description: formData.get("description") as string,
            parentId: formData.get("parentId") === "root" ? undefined : formData.get("parentId") as string
        }

        const result = await createCategory(data)

        if (result.success) {
            toast.success("Category created successfully")
            onSuccess()
        } else {
            setError(result.error as string)
            toast.error(result.error as string)
        }
        setIsLoading(false)
    }

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

                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="uppercase text-xs font-bold text-muted-foreground">Category Name</Label>
                                <Input name="name" placeholder="e.g. Raw Material" className="border-black focus-visible:ring-black font-bold" required />
                            </div>
                            <div className="space-y-2">
                                <Label className="uppercase text-xs font-bold text-muted-foreground">Category Code</Label>
                                <Input name="code" placeholder="e.g. RAW-001" className="border-black focus-visible:ring-black font-mono" required />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="uppercase text-xs font-bold text-muted-foreground">Parent Category</Label>
                            <Select name="parentId">
                                <SelectTrigger className="border-black focus:ring-black font-medium">
                                    <SelectValue placeholder="Select Parent (Optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="root">No Parent (Root Category)</SelectItem>
                                    {parents.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="uppercase text-xs font-bold text-muted-foreground">Description</Label>
                            <Textarea name="description" placeholder="Describe what items belong here..." className="border-black focus-visible:ring-black min-h-[100px]" />
                        </div>
                        {error && <p className="text-red-600 text-sm font-bold">{error}</p>}
                    </div>

                    <DialogFooter className="p-4 border-t border-black bg-zinc-50 flex gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 border-black font-bold uppercase bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="flex-1 bg-black text-white hover:bg-zinc-800 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase font-bold tracking-wide">
                            {isLoading ? "Saving..." : "Create Category"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

function CategoryDetailDialog({ category, open, onOpenChange }: { category: any, open: boolean, onOpenChange: (v: boolean) => void }) {
    // Simplified detail view
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 gap-0 bg-white">
                <DialogHeader className={`p-6 border-b border-black bg-white`}>
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
                        {category.description || "No description provided."}
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    <p>Details not fully implemented in this view yet.</p>
                </div>

                <DialogFooter className="p-4 border-t border-black bg-zinc-50 flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-black font-bold uppercase">Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
