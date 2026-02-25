import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { DocumentService } from '@/lib/services/document-service'
import { formatRupiah } from '@/lib/utils'

function resolveMaterialUnitCost(material: any): number {
    const directCost = Number(material.costPrice || 0)
    if (directCost > 0) return directCost
    const preferred = material.supplierItems?.find((s: any) => s.isPreferred)?.price
    if (preferred != null) return Number(preferred || 0)
    return Number(material.supplierItems?.[0]?.price || 0)
}

// GET /api/manufacturing/production-bom/[id]/pdf
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }
        const { id } = await params

        const bom = await prisma.productionBOM.findUnique({
            where: { id },
            include: {
                product: { select: { id: true, code: true, name: true, unit: true } },
                items: {
                    include: {
                        material: {
                            select: {
                                id: true, code: true, name: true, unit: true, costPrice: true,
                                supplierItems: { select: { price: true, isPreferred: true } },
                            },
                        },
                    },
                },
                steps: {
                    include: {
                        station: {
                            select: {
                                id: true, name: true, stationType: true, operationType: true, costPerUnit: true,
                                subcontractor: { select: { name: true } },
                            },
                        },
                        materials: {
                            include: {
                                bomItem: { include: { material: { select: { id: true, name: true, unit: true } } } },
                            },
                        },
                        allocations: {
                            include: {
                                station: { select: { name: true, subcontractor: { select: { name: true } } } },
                            },
                        },
                        attachments: { select: { fileName: true } },
                    },
                    orderBy: { sequence: 'asc' },
                },
            },
        })

        if (!bom) {
            return NextResponse.json({ success: false, error: 'BOM not found' }, { status: 404 })
        }

        // Calculate costs
        const totalMaterialCost = bom.items.reduce((sum, item) => {
            const unitCost = resolveMaterialUnitCost(item.material)
            const qty = Number(item.quantityPerUnit)
            const waste = Number(item.wastePct || 0)
            return sum + unitCost * qty * (1 + waste / 100)
        }, 0)

        const totalLaborCost = bom.steps.reduce((sum, step) => {
            return sum + Number(step.station.costPerUnit || 0)
        }, 0)

        const costPerUnit = totalMaterialCost + totalLaborCost
        const totalCost = costPerUnit * bom.totalProductionQty

        const templateData = {
            product_name: bom.product.name,
            product_code: bom.product.code,
            version: bom.version,
            total_qty: bom.totalProductionQty,
            date: new Date().toISOString().split('T')[0],
            steps: bom.steps.map((step) => ({
                sequence: step.sequence,
                station_name: step.station.name,
                operation_type: step.station.operationType === 'SUBCONTRACTOR' ? 'Subkontraktor' : 'In-House',
                subcontractor: step.station.subcontractor?.name || '',
                duration: step.durationMinutes ? String(step.durationMinutes) : '',
                materials: step.materials.map((m) => {
                    const bomItem = bom.items.find((i) => i.id === m.bomItemId)
                    return {
                        name: m.bomItem?.material?.name || 'Unknown',
                        qty: bomItem ? String(Number(bomItem.quantityPerUnit)) : '-',
                        unit: m.bomItem?.material?.unit || bomItem?.unit || '-',
                    }
                }),
                allocations: step.allocations.map((a) => ({
                    station_name: a.station.name + (a.station.subcontractor ? ` (${a.station.subcontractor.name})` : ''),
                    quantity: String(a.quantity),
                })),
                attachments: (step.attachments || []).map((a) => a.fileName),
            })),
            items: bom.items.map((item) => ({
                name: item.material.name,
                code: item.material.code,
                qty_per_unit: String(Number(item.quantityPerUnit)),
                waste_pct: String(Number(item.wastePct || 0)),
                unit: item.unit || item.material.unit || '-',
                cost: formatRupiah(resolveMaterialUnitCost(item.material) * Number(item.quantityPerUnit), false),
            })),
            summary: {
                material_count: String(bom.items.length),
                step_count: String(bom.steps.length),
                material_cost: formatRupiah(totalMaterialCost, false),
                labor_cost: formatRupiah(totalLaborCost, false),
                cost_per_unit: formatRupiah(costPerUnit, false),
                total_cost: formatRupiah(totalCost, false),
            },
        }

        const pdfBuffer = await DocumentService.generatePDF('production_bom', templateData)

        return new NextResponse(pdfBuffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="BOM-${bom.product.code}-${bom.version}.pdf"`,
            },
        })
    } catch (error: any) {
        console.error('Error generating BOM PDF:', error)
        return NextResponse.json({ success: false, error: error?.message || 'Failed to generate PDF' }, { status: 500 })
    }
}
