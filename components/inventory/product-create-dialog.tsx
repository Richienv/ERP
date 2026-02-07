"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ProductForm } from "@/components/inventory/product-form"
import { createProduct } from "@/app/actions/inventory"
import { Plus } from "lucide-react"
import { type CreateProductInput } from "@/lib/validations"

interface ProductCreateDialogProps {
    categories: { id: string; name: string; code: string }[]
}

import { useRouter } from "next/navigation"

export function ProductCreateDialog({ categories }: ProductCreateDialogProps) {
    const [open, setOpen] = useState(false)
    const router = useRouter()

    const handleSubmit = async (data: CreateProductInput) => {
        const result = await createProduct(data)
        if (result.success) {
            setOpen(false)
            router.refresh() // Refresh server components to show new data
        } else {
            // Form usually handles toast on error, but we can throw here if needed
            // ProductForm catches error but here we just pass the result.
            // Wait, ProductForm expects a promise.
            if (result.error) throw new Error(result.error)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> New Product
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Product</DialogTitle>
                    <DialogDescription>
                        Add a new product to your inventory.
                    </DialogDescription>
                </DialogHeader>
                <ProductForm
                    categories={categories}
                    onSubmit={handleSubmit}
                    onCancel={() => setOpen(false)}
                />
            </DialogContent>
        </Dialog>
    )
}
