import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { deleteProduct } from '@/app/actions/inventory'

import { ApiResponse, ProductWithRelations } from '@/lib/types'

// Matches Prisma enum ProductType { MANUFACTURED, TRADING, RAW_MATERIAL, WIP }
const PRODUCT_TYPE_VALUES = ['MANUFACTURED', 'TRADING', 'RAW_MATERIAL', 'WIP'] as const

// Matches Prisma enum CostingMethod { AVERAGE, FIFO }
const COSTING_METHOD_VALUES = ['AVERAGE', 'FIFO'] as const

// PUT validates partial updates — every field optional but each one bounded.
// Cross-field refine ensures minStock <= maxStock when both are provided so
// the inventory revaluation can never go negative on bad input.
const ProductUpdateSchema = z
  .object({
    code: z.string().trim().min(1).max(50).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    barcode: z.string().trim().max(100).optional().nullable(),
    costPrice: z.coerce.number().min(0).max(1e12).optional(),
    sellingPrice: z
      .union([z.coerce.number().min(0).max(1e12), z.literal('').transform(() => null), z.null()])
      .optional(),
    minStock: z.coerce.number().int().min(0).max(1e9).optional(),
    maxStock: z.coerce.number().int().min(0).max(1e9).optional(),
    reorderLevel: z.coerce.number().int().min(0).max(1e9).optional(),
    productType: z.enum(PRODUCT_TYPE_VALUES).optional(),
    costingMethod: z.enum(COSTING_METHOD_VALUES).optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    categoryId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.minStock === undefined ||
      data.maxStock === undefined ||
      data.minStock <= data.maxStock,
    { message: 'minStock harus ≤ maxStock', path: ['minStock'] }
  )

// GET /api/products/[id] - Get single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        stockLevels: {
          include: {
            warehouse: true,
            location: true,
          },
        },
        transactions: {
          include: {
            warehouse: true,
            purchaseOrder: { select: { number: true } },
            salesOrder: { select: { number: true } },
            workOrder: { select: { number: true } },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // Last 10 transactions
        },
        _count: {
          select: {
            stockLevels: true,
            transactions: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Calculate current stock
    const currentStock = product.stockLevels.reduce((sum, level) => sum + Number(level.quantity), 0)

    let stockStatus = 'normal'
    if (currentStock <= 0) {
      stockStatus = 'out'
    } else if (currentStock <= product.minStock * 0.5) {
      stockStatus = 'critical'
    } else if (currentStock <= product.minStock) {
      stockStatus = 'low'
    }

    const productWithStock = {
      ...product,
      currentStock,
      stockStatus,
    }

    const response: ApiResponse<ProductWithRelations> = {
      success: true,
      data: productWithStock,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

// PUT /api/products/[id] - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const rawBody = await request.json()

    // Validate body — bounds-check numerics, reject NaN, enforce minStock <= maxStock.
    const parsed = ProductUpdateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Data produk tidak valid',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }
    const body = parsed.data

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Cross-field check against persisted state: if only one of minStock/maxStock
    // is being updated, ensure it stays consistent with the existing value.
    const nextMinStock = body.minStock ?? existingProduct.minStock
    const nextMaxStock = body.maxStock ?? existingProduct.maxStock
    if (nextMinStock > nextMaxStock) {
      return NextResponse.json(
        {
          success: false,
          error: 'Data produk tidak valid',
          details: { minStock: ['minStock harus ≤ maxStock'] },
        },
        { status: 400 }
      )
    }

    // Check if code is being changed and already exists
    if (body.code && body.code !== existingProduct.code) {
      const codeExists = await prisma.product.findUnique({
        where: { code: body.code },
      })

      if (codeExists) {
        return NextResponse.json(
          { success: false, error: 'Product code already exists' },
          { status: 409 }
        )
      }
    }

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        ...(body.code !== undefined && { code: body.code }),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.unit !== undefined && { unit: body.unit }),
        ...(body.costPrice !== undefined && { costPrice: body.costPrice }),
        ...(body.sellingPrice !== undefined && { sellingPrice: body.sellingPrice }),
        ...(body.minStock !== undefined && { minStock: body.minStock }),
        ...(body.maxStock !== undefined && { maxStock: body.maxStock }),
        ...(body.reorderLevel !== undefined && { reorderLevel: body.reorderLevel }),
        ...(body.barcode !== undefined && { barcode: body.barcode }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.costingMethod !== undefined && { costingMethod: body.costingMethod }),
        ...(body.productType !== undefined && { productType: body.productType }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        updatedAt: new Date(),
      },
      include: {
        category: true,
      },
    })

    const response: ApiResponse<ProductWithRelations> = {
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully',
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Delete (or deactivate) product.
//
// Delegates to the `deleteProduct` server action so a single source of
// truth checks every FK relation that references Product (stockLevels,
// transactions, quotationItems, salesOrderItems, purchaseOrderItems,
// BOMItem, workOrders, stockReservations, fabricRolls, priceListItems,
// inspections). Returns the action's `{success, error}` shape mirrored
// into HTTP status codes.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Confirm the product exists so we can return a clean 404 instead of
    // funneling "not found" through the action's generic error surface.
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Delegate to the canonical deleteProduct server action.
    const result = await deleteProduct(id)

    if (!result.success) {
      // Soft-conflict: product has FK references that block deletion.
      // Use 409 (Conflict) so the client can surface the message verbatim.
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 409 }
      )
    }

    const response: ApiResponse = {
      success: true,
      message: 'Produk berhasil dinonaktifkan',
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus produk' },
      { status: 500 }
    )
  }
}