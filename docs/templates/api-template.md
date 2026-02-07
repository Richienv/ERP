# Template Dokumentasi API

## 📋 Informasi API

| **Aspek** | **Detail** |
|-----------|------------|
| **Nama API** | [Nama API Endpoint] |
| **Base URL** | `/api/[module]/[endpoint]` |
| **Versi** | [v1.0] |
| **Tanggal Dibuat** | [YYYY-MM-DD] |
| **Developer** | [Nama Developer] |
| **Status** | [Development/Testing/Production] |
| **Authentication** | [Required/Optional/None] |

---

## 🎯 Deskripsi API

**Tujuan:**
[Jelaskan tujuan dan fungsi API ini dalam 2-3 kalimat]

**Use Cases:**
- [Use case 1]
- [Use case 2]
- [Use case 3]

---

## 🔐 Authentication

### Required Headers

```typescript
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

### Permission Requirements

| **Method** | **Permission Required** | **Role** |
|------------|------------------------|----------|
| GET | `read:[module]` | User, Manager, Admin |
| POST | `create:[module]` | Manager, Admin |
| PUT | `update:[module]` | Manager, Admin |
| DELETE | `delete:[module]` | Admin |

---

## 📡 Endpoints

### GET - Mendapatkan Data

#### Endpoint
```
GET /api/[module]/[endpoint]
```

#### Query Parameters

| **Parameter** | **Type** | **Required** | **Default** | **Description** |
|---------------|----------|--------------|-------------|-----------------|
| `page` | number | No | 1 | Nomor halaman untuk pagination |
| `limit` | number | No | 10 | Jumlah item per halaman |
| `search` | string | No | - | Keyword pencarian |
| `sort` | string | No | 'createdAt' | Field untuk sorting |
| `order` | 'asc' \| 'desc' | No | 'desc' | Urutan sorting |
| `filter` | string | No | - | Filter berdasarkan status/kategori |

#### Request Example

```bash
# Basic request
GET /api/inventory/products

# With parameters
GET /api/inventory/products?page=2&limit=20&search=laptop&sort=name&order=asc
```

#### Response Success (200)

```json
{
  "success": true,
  "message": "Data berhasil diambil",
  "data": [
    {
      "id": "prod_001",
      "name": "Laptop Dell",
      "sku": "LPT-DELL-001",
      "price": 15000000,
      "stock": 10,
      "category": "Electronics",
      "status": "active",
      "createdAt": "2025-11-02T10:00:00.000Z",
      "updatedAt": "2025-11-02T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### Response Errors

```json
// 400 - Bad Request
{
  "success": false,
  "message": "Parameter tidak valid",
  "errors": [
    {
      "field": "limit",
      "message": "Limit maksimal 100"
    }
  ]
}

// 401 - Unauthorized
{
  "success": false,
  "message": "Token tidak valid atau sudah expired"
}

// 403 - Forbidden
{
  "success": false,
  "message": "Tidak memiliki permission untuk mengakses resource ini"
}

// 500 - Internal Server Error
{
  "success": false,
  "message": "Terjadi kesalahan server internal"
}
```

---

### GET - Mendapatkan Data Spesifik

#### Endpoint
```
GET /api/[module]/[endpoint]/{id}
```

#### Path Parameters

| **Parameter** | **Type** | **Required** | **Description** |
|---------------|----------|--------------|-----------------|
| `id` | string | Yes | ID unique dari resource |

#### Request Example

```bash
GET /api/inventory/products/prod_001
```

#### Response Success (200)

```json
{
  "success": true,
  "message": "Data berhasil diambil",
  "data": {
    "id": "prod_001",
    "name": "Laptop Dell",
    "sku": "LPT-DELL-001",
    "description": "Laptop Dell Inspiron 15 3000",
    "price": 15000000,
    "costPrice": 12000000,
    "stock": 10,
    "category": "Electronics",
    "status": "active",
    "supplier": {
      "id": "sup_001",
      "name": "PT. Tech Supplier"
    },
    "createdAt": "2025-11-02T10:00:00.000Z",
    "updatedAt": "2025-11-02T10:00:00.000Z"
  }
}
```

#### Response Errors

```json
// 404 - Not Found
{
  "success": false,
  "message": "Data dengan ID prod_999 tidak ditemukan"
}
```

---

### POST - Membuat Data Baru

#### Endpoint
```
POST /api/[module]/[endpoint]
```

#### Request Body

```json
{
  "name": "Laptop HP",
  "sku": "LPT-HP-001",
  "description": "Laptop HP Pavilion 14",
  "price": 12000000,
  "costPrice": 10000000,
  "categoryId": "cat_001",
  "supplierId": "sup_001",
  "initialStock": 5,
  "reorderLevel": 2
}
```

#### Validation Rules

| **Field** | **Type** | **Required** | **Validation** |
|-----------|----------|--------------|----------------|
| `name` | string | Yes | Min 3, Max 100 characters |
| `sku` | string | Yes | Unique, Format: XXX-XXX-XXX |
| `price` | number | Yes | > 0 |
| `categoryId` | string | Yes | Must exist in categories |
| `initialStock` | number | No | >= 0 |

#### Request Example

```bash
POST /api/inventory/products
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Laptop HP",
  "sku": "LPT-HP-001",
  "price": 12000000,
  "categoryId": "cat_001"
}
```

#### Response Success (201)

```json
{
  "success": true,
  "message": "Produk berhasil dibuat",
  "data": {
    "id": "prod_002",
    "name": "Laptop HP",
    "sku": "LPT-HP-001",
    "price": 12000000,
    "stock": 0,
    "status": "active",
    "createdAt": "2025-11-02T11:00:00.000Z",
    "updatedAt": "2025-11-02T11:00:00.000Z"
  }
}
```

#### Response Errors

```json
// 400 - Validation Error
{
  "success": false,
  "message": "Data tidak valid",
  "errors": [
    {
      "field": "sku",
      "message": "SKU sudah digunakan"
    },
    {
      "field": "price",
      "message": "Harga harus lebih besar dari 0"
    }
  ]
}

// 422 - Business Logic Error
{
  "success": false,
  "message": "Kategori dengan ID cat_999 tidak ditemukan"
}
```

---

### PUT - Mengupdate Data

#### Endpoint
```
PUT /api/[module]/[endpoint]/{id}
```

#### Path Parameters

| **Parameter** | **Type** | **Required** | **Description** |
|---------------|----------|--------------|-----------------|
| `id` | string | Yes | ID dari resource yang akan diupdate |

#### Request Body

```json
{
  "name": "Laptop HP Updated",
  "price": 11000000,
  "description": "Updated description"
}
```

#### Request Example

```bash
PUT /api/inventory/products/prod_002
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Laptop HP Updated",
  "price": 11000000
}
```

#### Response Success (200)

```json
{
  "success": true,
  "message": "Produk berhasil diupdate",
  "data": {
    "id": "prod_002",
    "name": "Laptop HP Updated",
    "sku": "LPT-HP-001",
    "price": 11000000,
    "stock": 0,
    "status": "active",
    "createdAt": "2025-11-02T11:00:00.000Z",
    "updatedAt": "2025-11-02T12:00:00.000Z"
  }
}
```

---

### DELETE - Menghapus Data

#### Endpoint
```
DELETE /api/[module]/[endpoint]/{id}
```

#### Path Parameters

| **Parameter** | **Type** | **Required** | **Description** |
|---------------|----------|--------------|-----------------|
| `id` | string | Yes | ID dari resource yang akan dihapus |

#### Request Example

```bash
DELETE /api/inventory/products/prod_002
Authorization: Bearer <token>
```

#### Response Success (200)

```json
{
  "success": true,
  "message": "Produk berhasil dihapus"
}
```

#### Response Errors

```json
// 409 - Conflict
{
  "success": false,
  "message": "Produk tidak dapat dihapus karena masih memiliki stock"
}
```

---

## 📊 Data Models

### Request/Response Types

```typescript
// Base Response Interface
interface APIResponse<T = any> {
  success: boolean
  message: string
  data?: T
  meta?: PaginationMeta
  errors?: ValidationError[]
}

// Pagination Meta
interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// Validation Error
interface ValidationError {
  field: string
  message: string
  code?: string
}

// Main Entity Interface
interface [EntityName] {
  id: string
  // Entity specific fields
  createdAt: string
  updatedAt: string
}

// Create Request Interface
interface Create[EntityName]Request {
  // Required fields for creation
}

// Update Request Interface
interface Update[EntityName]Request {
  // Optional fields for update
}
```

---

## 🔍 Query Features

### Search

```bash
# Text search in multiple fields
GET /api/inventory/products?search=laptop

# Search in specific field
GET /api/inventory/products?name=laptop&category=electronics
```

### Filtering

```bash
# Filter by status
GET /api/inventory/products?status=active

# Filter by date range
GET /api/inventory/products?createdAfter=2025-01-01&createdBefore=2025-12-31

# Multiple filters
GET /api/inventory/products?status=active&category=electronics&inStock=true
```

### Sorting

```bash
# Sort by single field
GET /api/inventory/products?sort=name&order=asc

# Sort by multiple fields
GET /api/inventory/products?sort=category,name&order=asc,desc
```

### Pagination

```bash
# Basic pagination
GET /api/inventory/products?page=2&limit=20

# Get all (use with caution)
GET /api/inventory/products?limit=-1
```

---

## 🚨 Error Handling

### Error Codes

| **HTTP Code** | **Meaning** | **Common Causes** |
|---------------|-------------|-------------------|
| 400 | Bad Request | Invalid parameters, malformed JSON |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Business rule violation |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Response Format

```json
{
  "success": false,
  "message": "Human readable error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error context
  },
  "timestamp": "2025-11-02T12:00:00.000Z",
  "requestId": "req_12345"
}
```

---

## 🔄 Rate Limiting

### Limits

| **Endpoint Type** | **Limit** | **Window** |
|-------------------|-----------|------------|
| Read Operations | 1000 req/hour | Per user |
| Write Operations | 100 req/hour | Per user |
| Search Operations | 500 req/hour | Per user |

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1635724800
```

---

## 🧪 Testing

### Manual Testing

```bash
# Test with curl
curl -X GET \
  'http://localhost:3000/api/inventory/products' \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json'
```

### Automated Testing

```typescript
import { testApiEndpoint } from '@/test-utils'

describe('GET /api/inventory/products', () => {
  it('should return products list', async () => {
    const response = await testApiEndpoint({
      method: 'GET',
      url: '/api/inventory/products',
      auth: true
    })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(Array.isArray(response.body.data)).toBe(true)
  })
})
```

---

## 📝 Change Log

| **Version** | **Date** | **Changes** | **Developer** |
|-------------|----------|-------------|---------------|
| 1.0.0 | YYYY-MM-DD | Initial API creation | [Nama] |
| 1.0.1 | YYYY-MM-DD | Added filtering support | [Nama] |

---

## 🔗 Related APIs

- [`/api/[related-endpoint]`](./[related-api].md) - [Deskripsi relasi]

---

**Template ini harus digunakan untuk mendokumentasikan setiap API endpoint yang dibuat.**

*Terakhir diupdate: [Tanggal]*