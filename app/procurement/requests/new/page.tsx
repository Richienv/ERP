import { ArrowLeft, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { supabase } from "@/lib/supabase"

import { CreateRequestForm } from "@/components/procurement/create-request-form"

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
        <div className="flex-1 p-4 md:p-8 pt-6 max-w-4xl mx-auto">
            {/* Back Button */}
            <Link
                href="/procurement/requests"
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors mb-5"
            >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Permintaan
            </Link>

            {/* Page Header */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-6 overflow-hidden bg-white dark:bg-zinc-900">
                <div className="px-6 py-4 flex items-center gap-3 border-l-[6px] border-l-violet-400">
                    <ClipboardList className="h-5 w-5 text-violet-500" />
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                            Buat Permintaan Baru
                        </h1>
                        <p className="text-zinc-400 text-xs font-medium mt-0.5">
                            Draft Purchase Request untuk pengadaan barang
                        </p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <CreateRequestForm
                products={products || []}
                employees={employees || []}
            />
        </div>
    )
}
