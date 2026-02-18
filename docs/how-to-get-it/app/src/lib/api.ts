// ============================================
// API CLIENT
// ============================================
// Centralized API calls with consistent error handling
// All functions return promises for use with TanStack Query
// ============================================

const API_BASE_URL = 'http://localhost:3001/api';

// Generic fetch wrapper with error handling
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================
// PRODUCTS API
// ============================================
export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  lastUpdated: string;
}

export interface ProductsResponse {
  data: Product[];
  total: number;
  page: number;
  totalPages: number;
}

export const productsApi = {
  getAll: (params?: { page?: number; limit?: number; search?: string; category?: string }) =>
    fetchApi<ProductsResponse>(`/products?page=${params?.page || 1}&limit=${params?.limit || 20}${params?.search ? `&search=${params.search}` : ''}${params?.category ? `&category=${params.category}` : ''}`),
  
  getById: (id: string) =>
    fetchApi<{ data: Product }>(`/products/${id}`),
  
  create: (data: Omit<Product, 'id' | 'lastUpdated'>) =>
    fetchApi<{ data: Product }>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<Product>) =>
    fetchApi<{ data: Product }>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) =>
    fetchApi<{ data: Product }>(`/products/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================
// SALES ORDERS API
// ============================================
export interface SalesOrder {
  id: string;
  customerName: string;
  total: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  items: number;
  createdAt: string;
}

export interface SalesOrdersResponse {
  data: SalesOrder[];
  total: number;
  page: number;
  totalPages: number;
}

export const salesOrdersApi = {
  getAll: (params?: { page?: number; limit?: number; status?: string }) =>
    fetchApi<SalesOrdersResponse>(`/sales-orders?page=${params?.page || 1}&limit=${params?.limit || 20}${params?.status ? `&status=${params.status}` : ''}`),
  
  create: (data: Omit<SalesOrder, 'id' | 'createdAt'>) =>
    fetchApi<{ data: SalesOrder }>('/sales-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<SalesOrder>) =>
    fetchApi<{ data: SalesOrder }>(`/sales-orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

// ============================================
// CUSTOMERS API
// ============================================
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
}

export interface CustomersResponse {
  data: Customer[];
  total: number;
  page: number;
  totalPages: number;
}

export const customersApi = {
  getAll: (params?: { page?: number; limit?: number }) =>
    fetchApi<CustomersResponse>(`/customers?page=${params?.page || 1}&limit=${params?.limit || 20}`),
};

// ============================================
// STATS API
// ============================================
export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  revenue: number;
  pendingOrders: number;
  lowStockProducts: number;
}

export const statsApi = {
  getDashboard: () =>
    fetchApi<{ data: DashboardStats }>('/stats'),
};
