import React from 'react';
import { Package, ShoppingCart, Users, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useStats } from '@/hooks/useStats';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================
// DASHBOARD VIEW
// ============================================
// Shows key metrics with auto-refresh
// Data is cached and updates in real-time
// ============================================

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  loading?: boolean;
}

function StatCard({ title, value, description, icon: Icon, trend, trendValue, loading }: StatCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
        <div className="p-2 bg-blue-50 rounded-lg">
          <Icon className="h-4 w-4 text-blue-600" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
        {trend && trendValue && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${
            trend === 'up' ? 'text-green-600' : 
            trend === 'down' ? 'text-red-600' : 'text-gray-500'
          }`}>
            <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
            <span>{trendValue}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const { data: statsData, isLoading } = useStats();
  const stats = statsData?.data;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-gray-500 mt-1">
          Real-time insights into your business performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Products"
          value={stats?.totalProducts ?? '-'}
          description="Active products in inventory"
          icon={Package}
          loading={isLoading}
        />
        
        <StatCard
          title="Total Orders"
          value={stats?.totalOrders ?? '-'}
          description="All-time sales orders"
          icon={ShoppingCart}
          loading={isLoading}
        />
        
        <StatCard
          title="Total Customers"
          value={stats?.totalCustomers ?? '-'}
          description="Registered customers"
          icon={Users}
          loading={isLoading}
        />
        
        <StatCard
          title="Revenue"
          value={stats ? formatCurrency(stats.revenue) : '-'}
          description="Total revenue from completed orders"
          icon={DollarSign}
          trend="up"
          trendValue="+12% from last month"
          loading={isLoading}
        />
        
        <StatCard
          title="Pending Orders"
          value={stats?.pendingOrders ?? '-'}
          description="Orders awaiting processing"
          icon={Clock}
          trend="down"
          trendValue="-5% from yesterday"
          loading={isLoading}
        />
        
        <StatCard
          title="Low Stock Alert"
          value={stats?.lowStockProducts ?? '-'}
          description="Products with stock below 50"
          icon={AlertTriangle}
          trend="neutral"
          trendValue="Action required"
          loading={isLoading}
        />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 text-sm font-bold">1</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Zero Loading Navigation</h4>
                <p className="text-sm text-gray-500">
                  Hover over sidebar items to prefetch data. When you click, 
                  the page loads instantly from cache.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 text-sm font-bold">2</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Optimistic Updates</h4>
                <p className="text-sm text-gray-500">
                  When you add or edit items, the UI updates immediately before 
                  the server confirms. No waiting!
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 text-sm font-bold">3</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Real-Time Sync</h4>
                <p className="text-sm text-gray-500">
                  Changes from other users appear automatically via WebSocket. 
                  No refresh needed!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Architecture Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 overflow-x-auto">
              <pre>{`
┌─────────────────────────────────────────┐
│  Browser (Single Page App)              │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Module  │  │  Data   │  │ WebSocket│ │
│  │  Cache  │  │  Cache  │  │  Sync    │ │
│  └────┬────┘  └────┬────┘  └────┬────┘ │
│       └─────────────┴─────────────┘     │
│              TanStack Query             │
└────────────────────┬────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
       REST      WebSocket    PostgreSQL
        │            │            │
  ┌─────┴────────────┴────────────┐
  │         Node.js Server         │
  └────────────────────────────────┘
              `}</pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
