"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, Plus, ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { createPurchaseRequest } from "@/lib/actions/procurement"
import Link from "next/link"

const itemSchema = z.object({
    productId: z.string().min(1, "Product is required"),
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
    notes: z.string().optional()
})

const formSchema = z.object({
    requesterId: z.string().min(1, "Requester is required"),
    department: z.string().optional(), // Could be inferred
    priority: z.string().default("NORMAL"),
    notes: z.string().optional(),
    items: z.array(itemSchema).min(1, "At least one item is required")
})

type FormValues = z.infer<typeof formSchema>

interface Props {
    products: { id: string, name: string, unit: string, code: string }[]
    employees: { id: string, firstName: string, lastName: string | null, department: string }[]
}

export function CreateRequestForm({ products, employees }: Props) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Temporary state for adding new item
    const [newItem, setNewItem] = useState<{ productId: string, quantity: number, notes: string }>({
        productId: "",
        quantity: 1,
        notes: ""
    })

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            requesterId: "",
            priority: "NORMAL",
            notes: "",
            items: []
        }
    })

    const items = form.watch("items")

    const handleAddItem = () => {
        if (!newItem.productId) {
            toast.error("Please select a product")
            return
        }
        if (newItem.quantity < 1) {
            toast.error("Quantity must be greater than 0")
            return
        }

        // Check duplicate
        if (items.some(i => i.productId === newItem.productId)) {
            toast.error("Item already added")
            return
        }

        form.setValue("items", [...items, newItem])
        setNewItem({ productId: "", quantity: 1, notes: "" }) // Reset
    }

    const handleRemoveItem = (index: number) => {
        const current = form.getValues("items")
        form.setValue("items", current.filter((_, i) => i !== index))
    }

    const onSubmit = async (values: FormValues) => {
        setIsSubmitting(true)
        try {
            const result = await createPurchaseRequest(values)
            if (result.success) {
                toast.success("Purchase Request Created")
                router.push("/procurement/requests")
                router.refresh()
            } else {
                toast.error(result.error || "Failed to create request")
            }
        } catch (error) {
            toast.error("Something went wrong")
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const selectedProduct = products.find(p => p.id === newItem.productId)

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/procurement/requests">
                    <Button variant="outline" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1" />
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                    {/* Header Info */}
                    <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <CardHeader>
                            <CardTitle className="uppercase font-black">Request Details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="requesterId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Requester (Staff)</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select staff..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {employees.map(emp => (
                                                    <SelectItem key={emp.id} value={emp.id}>
                                                        {emp.firstName} {emp.lastName} ({emp.department})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Priority</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select priority..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="LOW">Low</SelectItem>
                                                <SelectItem value="NORMAL">Normal</SelectItem>
                                                <SelectItem value="HIGH">High</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem className="col-span-1 md:col-span-2">
                                        <FormLabel>Notes</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Any additional context (e.g. project name)..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    {/* Items Section */}
                    <Card className="border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="uppercase font-black">Items</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* Add Item Form */}
                            <div className="flex flex-col md:flex-row gap-4 items-end bg-zinc-50 p-4 rounded-lg border border-dashed border-zinc-200">
                                <div className="flex-1 w-full">
                                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground mb-1.5 block">Product</FormLabel>
                                    <Select
                                        value={newItem.productId}
                                        onValueChange={(val) => setNewItem({ ...newItem, productId: val })}
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Search product..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {products.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.code} - {p.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-24">
                                    <FormLabel className="text-xs uppercase font-bold text-muted-foreground mb-1.5 block">Qty</FormLabel>
                                    <Input
                                        type="number"
                                        min={1}
                                        className="bg-white"
                                        value={newItem.quantity}
                                        onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="text-sm pt-2 min-w-[60px] text-zinc-500 font-mono">
                                    {selectedProduct?.unit || '-'}
                                </div>
                                <Button type="button" onClick={handleAddItem} className="bg-black text-white hover:bg-zinc-800">
                                    <Plus className="h-4 w-4 mr-2" /> Add
                                </Button>
                            </div>

                            {/* Items Table */}
                            {items.length > 0 ? (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-zinc-100">
                                            <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.map((item, index) => {
                                                const p = products.find(x => x.id === item.productId)
                                                return (
                                                    <TableRow key={index}>
                                                        <TableCell>
                                                            <div className="font-medium">{p?.name}</div>
                                                            <div className="text-xs text-muted-foreground">{p?.code}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {item.quantity} {p?.unit}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                onClick={() => handleRemoveItem(index)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground text-sm italic">
                                    No items added yet.
                                </div>
                            )}

                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || items.length === 0}
                            className="bg-black text-white hover:bg-zinc-800 min-w-[150px] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                            Submit Request
                        </Button>
                    </div>

                </form>
            </Form>
        </div>
    )
}
