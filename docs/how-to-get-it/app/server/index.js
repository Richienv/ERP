const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// ============================================
// MOCK DATABASE
// ============================================
let products = Array.from({ length: 100 }, (_, i) => ({
  id: `prod-${i + 1}`,
  name: `Product ${i + 1}`,
  sku: `SKU-${1000 + i}`,
  price: Math.floor(Math.random() * 1000) + 50,
  stock: Math.floor(Math.random() * 500),
  category: ['Electronics', 'Clothing', 'Food', 'Tools'][Math.floor(Math.random() * 4)],
  lastUpdated: new Date().toISOString(),
}));

let salesOrders = Array.from({ length: 50 }, (_, i) => ({
  id: `order-${i + 1}`,
  customerName: `Customer ${i + 1}`,
  total: Math.floor(Math.random() * 5000) + 100,
  status: ['pending', 'processing', 'completed', 'cancelled'][Math.floor(Math.random() * 4)],
  items: Math.floor(Math.random() * 5) + 1,
  createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
}));

let customers = Array.from({ length: 30 }, (_, i) => ({
  id: `cust-${i + 1}`,
  name: `Customer ${i + 1}`,
  email: `customer${i + 1}@example.com`,
  phone: `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
  totalOrders: Math.floor(Math.random() * 20),
  totalSpent: Math.floor(Math.random() * 10000),
}));

// ============================================
// WEBSOCKET - REAL TIME SYNC
// ============================================
const clients = new Map();

function broadcast(message, excludeClientId) {
  const messageStr = JSON.stringify(message);
  clients.forEach((client, clientId) => {
    if (clientId !== excludeClientId && client.readyState === 1) {
      client.send(messageStr);
    }
  });
}

wss.on('connection', (ws, req) => {
  const clientId = uuidv4();
  clients.set(clientId, ws);
  
  console.log(`[WS] Client connected: ${clientId}, Total clients: ${clients.size}`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'CONNECTED',
    data: { clientId, timestamp: new Date().toISOString() }
  }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`[WS] Received from ${clientId}:`, data.type);
      
      // Handle different message types
      switch (data.type) {
        case 'SUBSCRIBE':
          ws.send(JSON.stringify({
            type: 'SUBSCRIBED',
            data: { tables: data.tables }
          }));
          break;
          
        case 'PING':
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          break;
      }
    } catch (error) {
      console.error('[WS] Error processing message:', error);
    }
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`[WS] Client disconnected: ${clientId}, Total clients: ${clients.size}`);
  });
  
  ws.on('error', (error) => {
    console.error(`[WS] Error for client ${clientId}:`, error);
  });
});

// ============================================
// API ROUTES - PRODUCTS
// ============================================
app.get('/api/products', (req, res) => {
  const { page = 1, limit = 20, search, category } = req.query;
  
  let result = [...products];
  
  // Filter by search
  if (search) {
    const searchLower = search.toLowerCase();
    result = result.filter(p => 
      p.name.toLowerCase().includes(searchLower) || 
      p.sku.toLowerCase().includes(searchLower)
    );
  }
  
  // Filter by category
  if (category) {
    result = result.filter(p => p.category === category);
  }
  
  // Pagination
  const start = (parseInt(page) - 1) * parseInt(limit);
  const end = start + parseInt(limit);
  const paginated = result.slice(start, end);
  
  // Simulate network delay (100-300ms)
  setTimeout(() => {
    res.json({
      data: paginated,
      total: result.length,
      page: parseInt(page),
      totalPages: Math.ceil(result.length / parseInt(limit)),
    });
  }, Math.random() * 200 + 100);
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  
  setTimeout(() => {
    if (product) {
      res.json({ data: product });
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  }, 100);
});

app.post('/api/products', (req, res) => {
  const newProduct = {
    id: `prod-${Date.now()}`,
    ...req.body,
    lastUpdated: new Date().toISOString(),
  };
  
  products.unshift(newProduct);
  
  // Broadcast to all clients
  broadcast({
    type: 'DATA_CHANGED',
    table: 'products',
    action: 'CREATE',
    data: newProduct,
  });
  
  setTimeout(() => {
    res.status(201).json({ data: newProduct });
  }, 150);
});

app.patch('/api/products/:id', (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  
  if (index !== -1) {
    products[index] = {
      ...products[index],
      ...req.body,
      lastUpdated: new Date().toISOString(),
    };
    
    // Broadcast update
    broadcast({
      type: 'DATA_CHANGED',
      table: 'products',
      action: 'UPDATE',
      data: products[index],
    });
    
    setTimeout(() => {
      res.json({ data: products[index] });
    }, 150);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  
  if (index !== -1) {
    const deleted = products.splice(index, 1)[0];
    
    broadcast({
      type: 'DATA_CHANGED',
      table: 'products',
      action: 'DELETE',
      data: { id: deleted.id },
    });
    
    setTimeout(() => {
      res.json({ data: deleted });
    }, 150);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// ============================================
// API ROUTES - SALES ORDERS
// ============================================
app.get('/api/sales-orders', (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  
  let result = [...salesOrders];
  
  if (status) {
    result = result.filter(o => o.status === status);
  }
  
  const start = (parseInt(page) - 1) * parseInt(limit);
  const end = start + parseInt(limit);
  const paginated = result.slice(start, end);
  
  setTimeout(() => {
    res.json({
      data: paginated,
      total: result.length,
      page: parseInt(page),
      totalPages: Math.ceil(result.length / parseInt(limit)),
    });
  }, Math.random() * 200 + 100);
});

app.post('/api/sales-orders', (req, res) => {
  const newOrder = {
    id: `order-${Date.now()}`,
    ...req.body,
    createdAt: new Date().toISOString(),
  };
  
  salesOrders.unshift(newOrder);
  
  broadcast({
    type: 'DATA_CHANGED',
    table: 'sales_orders',
    action: 'CREATE',
    data: newOrder,
  });
  
  setTimeout(() => {
    res.status(201).json({ data: newOrder });
  }, 150);
});

app.patch('/api/sales-orders/:id', (req, res) => {
  const index = salesOrders.findIndex(o => o.id === req.params.id);
  
  if (index !== -1) {
    salesOrders[index] = {
      ...salesOrders[index],
      ...req.body,
    };
    
    broadcast({
      type: 'DATA_CHANGED',
      table: 'sales_orders',
      action: 'UPDATE',
      data: salesOrders[index],
    });
    
    setTimeout(() => {
      res.json({ data: salesOrders[index] });
    }, 150);
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

// ============================================
// API ROUTES - CUSTOMERS
// ============================================
app.get('/api/customers', (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  const start = (parseInt(page) - 1) * parseInt(limit);
  const end = start + parseInt(limit);
  const paginated = customers.slice(start, end);
  
  setTimeout(() => {
    res.json({
      data: paginated,
      total: customers.length,
      page: parseInt(page),
      totalPages: Math.ceil(customers.length / parseInt(limit)),
    });
  }, Math.random() * 200 + 100);
});

// ============================================
// STATS ENDPOINT
// ============================================
app.get('/api/stats', (req, res) => {
  setTimeout(() => {
    res.json({
      data: {
        totalProducts: products.length,
        totalOrders: salesOrders.length,
        totalCustomers: customers.length,
        revenue: salesOrders
          .filter(o => o.status === 'completed')
          .reduce((sum, o) => sum + o.total, 0),
        pendingOrders: salesOrders.filter(o => o.status === 'pending').length,
        lowStockProducts: products.filter(p => p.stock < 50).length,
      }
    });
  }, 100);
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           ERP INSTANT-LOAD DEMO SERVER                     ║
╠════════════════════════════════════════════════════════════╣
║  HTTP API:  http://localhost:${PORT}                        ║
║  WebSocket: ws://localhost:${PORT}                          ║
╚════════════════════════════════════════════════════════════╝

Endpoints:
  GET  /api/products       - List products (paginated)
  GET  /api/products/:id   - Get single product
  POST /api/products       - Create product
  PATCH /api/products/:id  - Update product
  DELETE /api/products/:id - Delete product
  
  GET  /api/sales-orders   - List sales orders
  POST /api/sales-orders   - Create sales order
  
  GET  /api/customers      - List customers
  
  GET  /api/stats          - Dashboard stats
  `);
});

module.exports = { app, server, wss };
