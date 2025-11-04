import { useState, useEffect } from 'react'
import { ProductWithRelations, ProductFilters, PaginatedResponse, ApiResponse } from '@/lib/types'

interface UseProductsReturn {
  products: ProductWithRelations[]
  loading: boolean
  error: string | null
  pagination: PaginatedResponse<ProductWithRelations>['pagination'] | null
  refetch: () => Promise<void>
  createProduct: (productData: any) => Promise<boolean>
  updateProduct: (id: string, productData: any) => Promise<boolean>
  deleteProduct: (id: string) => Promise<boolean>
}

export function useProducts(filters?: ProductFilters): UseProductsReturn {
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginatedResponse<ProductWithRelations>['pagination'] | null>(null)

  const buildQueryString = (filters?: ProductFilters) => {
    if (!filters) return ''
    
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString())
      }
    })
    
    return params.toString()
  }

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)

      const queryString = buildQueryString(filters)
      const response = await fetch(`/api/products?${queryString}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data: PaginatedResponse<ProductWithRelations> = await response.json()
      
      if (data.success) {
        setProducts(data.data || [])
        setPagination(data.pagination)
      } else {
        setError(data.error || 'Failed to fetch products')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const createProduct = async (productData: any): Promise<boolean> => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      })

      const data: ApiResponse<ProductWithRelations> = await response.json()

      if (data.success) {
        await fetchProducts() // Refresh the list
        return true
      } else {
        setError(data.error || 'Failed to create product')
        return false
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      return false
    }
  }

  const updateProduct = async (id: string, productData: any): Promise<boolean> => {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      })

      const data: ApiResponse<ProductWithRelations> = await response.json()

      if (data.success) {
        await fetchProducts() // Refresh the list
        return true
      } else {
        setError(data.error || 'Failed to update product')
        return false
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      return false
    }
  }

  const deleteProduct = async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      })

      const data: ApiResponse = await response.json()

      if (data.success) {
        await fetchProducts() // Refresh the list
        return true
      } else {
        setError(data.error || 'Failed to delete product')
        return false
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      return false
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [filters?.search, filters?.categoryId, filters?.status, filters?.stockStatus, filters?.page, filters?.limit])

  return {
    products,
    loading,
    error,
    pagination,
    refetch: fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  }
}

// Hook for single product
export function useProduct(id: string) {
  const [product, setProduct] = useState<ProductWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const fetchProduct = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/products/${id}`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data: ApiResponse<ProductWithRelations> = await response.json()
        
        if (data.success) {
          setProduct(data.data || null)
        } else {
          setError(data.error || 'Failed to fetch product')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [id])

  return { product, loading, error }
}