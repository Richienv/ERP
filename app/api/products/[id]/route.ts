import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

import { ApiResponse, ProductWithRelations } from '@/lib/types'

// GET /api/products/[id] - Get single product
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const currentStock = product.stockLevels.reduce((sum, level) => sum + level.quantity, 0)

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
    const { id } = await params
    const body = await request.json()

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
        ...(body.code && { code: body.code }),
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.unit && { unit: body.unit }),
        ...(body.costPrice !== undefined && { costPrice: parseFloat(body.costPrice) }),
        ...(body.sellingPrice !== undefined && { sellingPrice: parseFloat(body.sellingPrice) }),
        ...(body.minStock !== undefined && { minStock: parseInt(body.minStock) }),
        ...(body.maxStock !== undefined && { maxStock: parseInt(body.maxStock) }),
        ...(body.reorderLevel !== undefined && { reorderLevel: parseInt(body.reorderLevel) }),
        ...(body.barcode !== undefined && { barcode: body.barcode }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
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

// DELETE /api/products/[id] - Delete (or deactivate) product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if product exists and count all dependent records
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stockLevels: true,
            transactions: true,
            quotationItems: true,
            salesOrderItems: true,
            purchaseOrderItems: true,
            BOMItem: true,
            workOrders: true,
          },
        },
      },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check for ANY dependent records across all referencing tables
    const counts = existingProduct._count
    const hasStock = counts.stockLevels > 0
    const hasMovements = counts.transactions > 0
    const hasSalesRefs = counts.quotationItems > 0 || counts.salesOrderItems > 0
    const hasProcurementRefs = counts.purchaseOrderItems > 0
    const hasManufacturingRefs = (counts.BOMItem || 0) > 0 || counts.workOrders > 0
    const hasDependencies = hasStock || hasMovements || hasSalesRefs || hasProcurementRefs || hasManufacturingRefs

    if (hasDependencies) {
      // Always soft-delete when any dependencies exist to avoid FK violations
      await prisma.product.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      })

      const reasons: string[] = []
      if (hasStock) reasons.push('stok aktif')
      if (hasMovements) reasons.push('riwayat pergerakan')
      if (hasSalesRefs) reasons.push('referensi penjualan')
      if (hasProcurementRefs) reasons.push('referensi pengadaan')
      if (hasManufacturingRefs) reasons.push('referensi manufaktur')

      const response: ApiResponse = {
        success: true,
        message: `Produk dinonaktifkan (memiliki ${reasons.join(', ')})`,
      }

      return NextResponse.json(response)
    } else {
      // Hard delete only when no references exist anywhere
      await prisma.product.delete({
        where: { id },
      })

      const response: ApiResponse = {
        success: true,
        message: 'Produk berhasil dihapus',
      }

      return NextResponse.json(response)
    }
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus produk' },
      { status: 500 }
    )
  }
}