import { prisma } from '@/lib/db'
import type { DocType } from '@prisma/client'

interface RenderTarget {
    templateName: string
    payload: any
}

export async function buildRenderTarget(type: DocType, entityId: string): Promise<RenderTarget> {
    switch (type) {
        case 'PO': {
            const po = await prisma.purchaseOrder.findUnique({
                where: { id: entityId },
                include: { items: true, supplier: true },
            })
            if (!po) throw new Error(`PO not found: ${entityId}`)
            return { templateName: 'purchase_order', payload: po }
        }
        case 'PR': {
            const pr = await prisma.purchaseRequest.findUnique({
                where: { id: entityId },
                include: { items: true },
            })
            if (!pr) throw new Error(`PR not found: ${entityId}`)
            return { templateName: 'purchase_order', payload: pr } // reuse PO template for now
        }
        case 'GRN': {
            const grn = await prisma.goodsReceivedNote.findUnique({
                where: { id: entityId },
                include: { items: true, purchaseOrder: { include: { supplier: true } } },
            })
            if (!grn) throw new Error(`GRN not found: ${entityId}`)
            return { templateName: 'surat_jalan_masuk', payload: grn }
        }
        case 'VENDOR_PROFILE': {
            const vendor = await prisma.supplier.findUnique({ where: { id: entityId } })
            if (!vendor) throw new Error(`Vendor not found: ${entityId}`)
            return { templateName: 'purchase_order', payload: vendor } // placeholder
        }
        case 'INVOICE_AR':
        case 'INVOICE_AP': {
            const inv = await prisma.invoice.findUnique({
                where: { id: entityId },
                include: { items: true, customer: true, supplier: true },
            })
            if (!inv) throw new Error(`Invoice not found: ${entityId}`)
            return { templateName: 'invoice', payload: inv }
        }
        default:
            throw new Error(`Render adapter not implemented for type: ${type}`)
    }
}
