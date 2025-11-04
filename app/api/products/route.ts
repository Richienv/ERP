import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { ProductFilters, ApiResponse, PaginatedResponse, ProductWithRelations } from '@/lib/types'

// GET /api/products - Fetch products with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters: ProductFilters = {
      search: searchParams.get('search') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      status: (searchParams.get('status') as 'active' | 'inactive') || undefined,
      stockStatus: (searchParams.get('stockStatus') as any) || undefined,
      sortBy: (searchParams.get('sortBy') as any) || 'name',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
    }

    // Build where clause
    const whereClause: any = {}

    if (filters.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    if (filters.categoryId) {
      whereClause.categoryId = filters.categoryId
    }

    if (filters.status === 'active') {
      whereClause.isActive = true
    } else if (filters.status === 'inactive') {
      whereClause.isActive = false
    }

    // Calculate offset for pagination
    const offset = ((filters.page || 1) - 1) * (filters.limit || 10)

    // Fetch products with relations
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        include: {
          category: true,
          stockLevels: {
            include: {
              warehouse: true,
            },
          },
          _count: {
            select: {
              stockLevels: true,
              stockMovements: true,
            },
          },
        },
        orderBy: {
          [filters.sortBy || 'name']: filters.sortOrder || 'asc',
        },
        skip: offset,
        take: filters.limit || 10,
      }),
      prisma.product.count({ where: whereClause }),
    ])

    // Calculate stock status for each product
    const productsWithStockStatus = products.map((product) => {
      const totalStock = product.stockLevels.reduce((sum, level) => sum + level.quantity, 0)
      
      let stockStatus = 'normal'
      if (totalStock <= 0) {
        stockStatus = 'out'
      } else if (totalStock <= product.minStock * 0.5) {
        stockStatus = 'critical'
      } else if (totalStock <= product.minStock) {
        stockStatus = 'low'
      }

      return {
        ...product,
        currentStock: totalStock,
        stockStatus,
      }
    })

    // Filter by stock status if specified
    let filteredProducts = productsWithStockStatus
    if (filters.stockStatus) {
      filteredProducts = productsWithStockStatus.filter(
        (product) => product.stockStatus === filters.stockStatus
      )
    }

    const totalPages = Math.ceil(totalCount / (filters.limit || 10))

    const response: PaginatedResponse<ProductWithRelations> = {
      success: true,
      data: filteredProducts,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 10,
        total: totalCount,
        totalPages,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// POST /api/products - Create new product
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate required fields
    const { code, name, unit, costPrice, sellingPrice, minStock, maxStock, reorderLevel } = body
    
    if (!code || !name || !unit) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: code, name, unit' },
        { status: 400 }
      )
    }

    // Check if product code already exists
    const existingProduct = await prisma.product.findUnique({
      where: { code },
    })

    if (existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product code already exists' },
        { status: 409 }
      )
    }

    // Create new product
    const product = await prisma.product.create({
      data: {
        code,
        name,
        description: body.description || null,
        categoryId: body.categoryId || null,
        unit,
        costPrice: parseFloat(costPrice || 0),
        sellingPrice: parseFloat(sellingPrice || 0),
        minStock: parseInt(minStock || 0),
        maxStock: parseInt(maxStock || 0),
        reorderLevel: parseInt(reorderLevel || 0),
        barcode: body.barcode || null,
        isActive: true,
      },
      include: {
        category: true,
      },
    })

    const response: ApiResponse<ProductWithRelations> = {
      success: true,
      data: product,
      message: 'Product created successfully',
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    )
  }
}