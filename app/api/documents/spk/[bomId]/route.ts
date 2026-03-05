import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { DocumentService } from '@/lib/services/document-service'

// GET /api/documents/spk/[bomId] — Generate SPK PDF from Production BOM
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ bomId: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }
        const { bomId } = await params
        const disposition = request.nextUrl.searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment'

        const bom = await prisma.productionBOM.findUnique({
            where: { id: bomId },
            include: {
                product: { select: { id: true, code: true, name: true, unit: true } },
                items: {
                    include: {
                        material: {
                            select: { id: true, code: true, name: true, unit: true },
                        },
                    },
                },
                steps: {
                    include: {
                        station: {
                            select: {
                                id: true, name: true, stationType: true, operationType: true,
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
                    },
                    orderBy: { sequence: 'asc' },
                },
            },
        })

        if (!bom) {
            return NextResponse.json({ success: false, error: 'Production BOM not found' }, { status: 404 })
        }

        // Generate SPK number from BOM
        const now = new Date()
        const monthRoman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][now.getMonth()]
        const spkNumber = `SPK-${bom.product.code}/${monthRoman}/${now.getFullYear()}`

        // Station type labels
        const STATION_LABELS: Record<string, string> = {
            CUTTING: 'Potong', SEWING: 'Jahit', WASHING: 'Cuci',
            PRINTING: 'Sablon', EMBROIDERY: 'Bordir', QC: 'Quality Control',
            PACKING: 'Packing', FINISHING: 'Finishing', OTHER: 'Lainnya',
        }

        // Calculate estimated time from canvas steps
        const estTimeTotalMin = bom.steps.reduce((sum, step) => sum + (Number(step.durationMinutes) || 0), 0)
        const estHours = Math.floor(estTimeTotalMin / 60)
        const estMinutes = Math.round(estTimeTotalMin % 60)
        const estTimeLabel = estTimeTotalMin > 0
            ? `${estHours > 0 ? `${estHours} jam ` : ''}${estMinutes} menit`
            : '-'

        const templateData = {
            spk_number: spkNumber,
            spk_date: now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
            print_date: now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            est_time: estTimeLabel,
            priority: 'NORMAL',
            company: {
                name: 'PT PERUSAHAAN',
                address: 'Alamat Perusahaan',
                contact: 'Telp: -',
                city: '',
            },
            product_name: bom.product.name,
            product_code: bom.product.code,
            bom_version: bom.version,
            total_qty: String(bom.totalProductionQty),
            notes: bom.notes || '',
            items: bom.items.map((item) => ({
                name: item.material.name,
                code: item.material.code,
                qty_per_unit: String(Number(item.quantityPerUnit)),
                waste_pct: String(Number(item.wastePct || 0)),
                unit: item.unit || item.material.unit || '-',
            })),
            steps: bom.steps.map((step) => {
                const isSubkon = step.useSubkon ?? step.station.operationType === 'SUBCONTRACTOR'
                const bomItems = bom.items
                return {
                    sequence: String(step.sequence),
                    station_name: step.station.name,
                    station_type: STATION_LABELS[step.station.stationType] || step.station.stationType,
                    operation_label: isSubkon ? 'Subkontraktor' : 'In-House',
                    subcontractor: isSubkon ? (step.station.subcontractor?.name || '') : '',
                    duration: step.durationMinutes ? String(step.durationMinutes) : '',
                    materials: step.materials.map((m) => {
                        const bomItem = bomItems.find((i) => i.id === m.bomItemId)
                        return {
                            name: m.bomItem?.material?.name || 'Unknown',
                            qty: bomItem ? String(Number(bomItem.quantityPerUnit)) : '-',
                            unit: m.bomItem?.material?.unit || '-',
                        }
                    }),
                    allocations: step.allocations.map((a) => ({
                        station_name: a.station.name + (a.station.subcontractor ? ` (${a.station.subcontractor.name})` : ''),
                        quantity: String(a.quantity),
                    })),
                }
            }),
        }

        const pdfBuffer = await DocumentService.generatePDF('spk', templateData)

        return new NextResponse(pdfBuffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `${disposition}; filename="SPK-${bom.product.code}-${bom.version}.pdf"`,
                'Cache-Control': 'no-store',
            },
        })
    } catch (error: any) {
        console.error('Error generating SPK PDF:', error)
        const isTypstMissing = error?.message?.includes('Typst binary not found')
        const msg = isTypstMissing
            ? 'PDF generator (Typst) belum terinstall. Hubungi administrator.'
            : `Gagal membuat dokumen SPK: ${error?.message}`
        return NextResponse.json({ success: false, error: msg }, { status: 500 })
    }
}
