
import { CreateRequestForm } from "@/components/procurement/create-request-form"
import { supabase } from "@/lib/supabase"

export default async function NewRequestPage() {
    // 1. Fetch Products with Category
    const { data: products } = await supabase
        .from('products')
        .select('id, name, unit, code, category:categories(name)')
        .order('name', { ascending: true })

    // 2. Fetch Employees (Active)
    const { data: employees } = await supabase
        .from('employees')
        .select('id, firstName, lastName, department')
        .eq('status', 'ACTIVE')

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
                <CreateRequestForm 
                    products={products || []} 
                    employees={employees || []} 
                />
            </div>
        </div>
    )
}
