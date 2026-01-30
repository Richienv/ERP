
import { CreateRequestForm } from "@/components/procurement/create-request-form"
import { getAllProducts } from "@/app/actions/inventory"
import { prisma } from "@/lib/prisma"

export default async function NewRequestPage() {
    // optimize: fetch minimal product data for select
    const products = await prisma.product.findMany({
        select: { id: true, name: true, unit: true, code: true, category: { select: { name: true } } },
        orderBy: { name: 'asc' }
    })

    // Mock employees for requester selection (in real app, use session)
    const employees = await prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true, department: true }
    })

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 font-sans">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black font-serif tracking-tight text-black flex items-center gap-2">
                        Buat Permintaan Baru
                    </h2>
                    <p className="text-muted-foreground mt-1 font-medium">Draft Purchase Request untuk pengadaan barang.</p>
                </div>
            </div>

            <div className="max-w-3xl">
                <CreateRequestForm products={products} employees={employees} />
            </div>
        </div>
    )
}
