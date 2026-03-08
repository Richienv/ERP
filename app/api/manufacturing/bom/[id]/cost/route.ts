import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { calculateBOMCost, type BOMCostInput } from "@/lib/bom-costing"

/**
 * Resolve the unit cost for a material:
 * 1. Product.costPrice (if > 0)
 * 2. Preferred supplier price
 * 3. First supplier price
 * 4. 0
 */
function resolveMaterialUnitCost(material: {
  costPrice: any
  supplierItems?: Array<{ price: any; isPreferred: boolean }>
}): number {
  const directCost = Number(material.costPrice || 0)
  if (directCost > 0) return directCost

  const preferredSupplierCost = material.supplierItems?.find((s) => s.isPreferred)?.price
  if (preferredSupplierCost !== undefined && preferredSupplierCost !== null) {
    return Number(preferredSupplierCost || 0)
  }

  const fallbackSupplierCost = material.supplierItems?.[0]?.price
  return Number(fallbackSupplierCost || 0)
}

// GET /api/manufacturing/bom/[id]/cost — Calculate BOM cost breakdown
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const bom = await prisma.billOfMaterials.findUnique({
      where: { id },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            unit: true,
            costPrice: true,
            sellingPrice: true,
          },
        },
        items: {
          include: {
            material: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                costPrice: true,
                supplierItems: {
                  select: {
                    price: true,
                    isPreferred: true,
                  },
                  orderBy: {
                    isPreferred: "desc" as const,
                  },
                  take: 3,
                },
              },
            },
          },
        },
      },
    })

    if (!bom) {
      return NextResponse.json(
        { success: false, error: "Bill of Materials tidak ditemukan" },
        { status: 404 }
      )
    }

    // Build input for the pure calculation function
    const costInput: BOMCostInput = {
      id: bom.id,
      productId: bom.productId,
      productName: bom.product.name,
      outputQty: 1, // BOM is always per 1 unit of finished good
      items: bom.items.map((item) => ({
        id: item.id,
        materialId: item.materialId,
        materialCode: item.material.code,
        materialName: item.material.name,
        unit: item.unit || item.material.unit,
        quantity: Number(item.quantity),
        wastePct: Number(item.wastePct),
        unitCost: resolveMaterialUnitCost(item.material),
      })),
    }

    const result = calculateBOMCost(costInput)

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        product: bom.product,
        version: bom.version,
        isActive: bom.isActive,
      },
    })
  } catch (error) {
    console.error("Error calculating BOM cost:", error)
    return NextResponse.json(
      { success: false, error: "Gagal menghitung biaya BOM" },
      { status: 500 }
    )
  }
}

// POST /api/manufacturing/bom/[id]/cost — Update product costPrice from BOM
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // First calculate the cost
    const bom = await prisma.billOfMaterials.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, name: true, costPrice: true },
        },
        items: {
          include: {
            material: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                costPrice: true,
                supplierItems: {
                  select: { price: true, isPreferred: true },
                  orderBy: { isPreferred: "desc" as const },
                  take: 3,
                },
              },
            },
          },
        },
      },
    })

    if (!bom) {
      return NextResponse.json(
        { success: false, error: "Bill of Materials tidak ditemukan" },
        { status: 404 }
      )
    }

    const costInput: BOMCostInput = {
      id: bom.id,
      productId: bom.productId,
      productName: bom.product.name,
      outputQty: 1,
      items: bom.items.map((item) => ({
        id: item.id,
        materialId: item.materialId,
        materialCode: item.material.code,
        materialName: item.material.name,
        unit: item.unit || item.material.unit,
        quantity: Number(item.quantity),
        wastePct: Number(item.wastePct),
        unitCost: resolveMaterialUnitCost(item.material),
      })),
    }

    const result = calculateBOMCost(costInput)

    // Update the product's costPrice
    const updatedProduct = await prisma.product.update({
      where: { id: bom.productId },
      data: { costPrice: result.costPerUnit },
      select: { id: true, name: true, costPrice: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        costPerUnit: result.costPerUnit,
        previousCostPrice: Number(bom.product.costPrice),
        updatedProduct,
      },
      message: `Harga pokok ${bom.product.name} diperbarui menjadi ${result.costPerUnit}`,
    })
  } catch (error) {
    console.error("Error updating product cost from BOM:", error)
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui harga pokok produk" },
      { status: 500 }
    )
  }
}
