import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/manufacturing/production-bom/[id]/work-orders
// Deletes all WorkOrders linked to this BOM so SPK can be re-generated.
// Only allowed if no work orders are IN_PROGRESS or COMPLETED.
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        // Guard: check if any WOs are already in progress or completed
        const activeWOs = await prisma.workOrder.count({
            where: {
                productionBomId: id,
                status: { in: ['IN_PROGRESS', 'COMPLETED'] },
            },
        })

        if (activeWOs > 0) {
            return NextResponse.json(
                { error: `Tidak dapat reset: ${activeWOs} SPK sudah berjalan atau selesai.` },
                { status: 409 }
            )
        }

        // Delete all PLANNED / ON_HOLD work orders for this BOM
        const { count } = await prisma.workOrder.deleteMany({
            where: { productionBomId: id },
        })

        return NextResponse.json({ success: true, deleted: count })
    } catch (error: any) {
        console.error('Error resetting SPK work orders:', error)
        return NextResponse.json({ error: error?.message || 'Gagal mereset SPK' }, { status: 500 })
    }
}
