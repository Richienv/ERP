import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { ApiResponse, ProductWithRelations } from '@/lib/types'

// GET /api/products/[id] - Get single product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

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
        stockMovements: {
          include: {
            warehouse: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // Last 10 movements
        },
        _count: {
          select: {
            stockLevels: true,
            stockMovements: true,
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
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

// DELETE /api/products/[id] - Delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        stockLevels: true,
        stockMovements: true,
      },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check if product has stock or movements
    const hasStock = existingProduct.stockLevels.some(level => level.quantity > 0)
    const hasMovements = existingProduct.stockMovements.length > 0

    if (hasStock || hasMovements) {
      // Soft delete - mark as inactive instead of hard delete
      await prisma.product.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      })

      const response: ApiResponse = {
        success: true,
        message: 'Product deactivated successfully (has stock history)',
      }

      return NextResponse.json(response)
    } else {
      // Hard delete if no stock or movements
      await prisma.product.delete({
        where: { id },
      })

      const response: ApiResponse = {
        success: true,
        message: 'Product deleted successfully',
      }

      return NextResponse.json(response)
    }
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}