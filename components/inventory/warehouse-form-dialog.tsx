"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createWarehouse, updateWarehouse } from "@/app/actions/inventory"
import { toast } from "sonner"
import { Edit, Loader2, Plus, Save } from "lucide-react"
import { useRouter } from "next/navigation"

interface WarehouseFormDialogProps {
    mode: 'create' | 'edit'
    warehouse?: {
        id: string
        name: string
        code: string
        address: string
        capacity?: number
    }
    trigger?: React.ReactNode // Custom trigger button
}

export function WarehouseFormDialog({ mode, warehouse, trigger }: WarehouseFormDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const [formData, setFormData] = useState({
        name: warehouse?.name || '',
        code: warehouse?.code || '',
        address: warehouse?.address || '',
        capacity: warehouse?.capacity || 10000
    })

    const handleSubmit = async () => {
        setLoading(true)
        try {
            let result
            if (mode === 'create') {
                result = await createWarehouse(formData)
            } else {
                if (!warehouse?.id) return
                result = await updateWarehouse(warehouse.id, formData)
            }

            if (result.success) {
                toast.success(mode === 'create' ? "Warehouse created!" : "Warehouse updated!")
                setOpen(false)
                if (mode === 'create') {
                    // Reset form
                    setFormData({ name: '', code: '', address: '', capacity: 10000 })
                }
                router.refresh()
            } else {
                toast.error("Operation failed", { description: result.error })
            }
        } catch (e) {
            toast.error("An error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? trigger : (
                    <Button variant={mode === 'create' ? 'default' : 'outline'} className={`uppercase font-bold ${mode === 'create' ? 'bg-black text-white hover:bg-zinc-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' : 'border-black hover:bg-zinc-100'}`}>
                        {mode === 'create' ? <Plus className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                        {mode === 'create' ? "Add Warehouse" : "Edit Configuration"}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white rounded-xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black uppercase">{mode === 'create' ? 'Create New Warehouse' : 'Edit Warehouse'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'create' ? 'Add a new location to your inventory network.' : 'Update the details for connection and logistics.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="font-bold">Name</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="border-2 border-black font-medium"
                            placeholder="e.g. Central Distribution Hub"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="code" className="font-bold">Code</Label>
                        <Input
                            id="code"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            className="border-2 border-black font-medium"
                            placeholder="e.g. WH-001"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="address" className="font-bold">Full Address</Label>
                        <Input
                            id="address"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="border-2 border-black font-medium"
                            placeholder="Street, City, Province"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="capacity" className="font-bold">Max Capacity</Label>
                        <Input
                            id="capacity"
                            type="number"
                            value={formData.capacity}
                            onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                            className="border-2 border-black font-medium"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={loading} className="w-full bg-black text-white hover:bg-zinc-800 font-bold border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                        {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                        {mode === 'create' ? 'Create Warehouse' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
