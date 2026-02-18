import { useState } from 'react';
import { Plus, ShoppingCart, Loader2, CheckCircle, Clock, XCircle, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSalesOrders, useCreateSalesOrder, useUpdateSalesOrder } from '@/hooks/useSalesOrders';
import { SalesOrderForm } from '@/components/sales/SalesOrderForm';
import type { SalesOrder } from '@/lib/api';

// ============================================
// SALES ORDERS VIEW
// ============================================

export function SalesOrdersView() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data, isLoading, isFetching } = useSalesOrders({ 
    page, 
    limit: 10,
    status: statusFilter || undefined,
  });

  const createMutation = useCreateSalesOrder();
  const updateMutation = useUpdateSalesOrder();

  const orders = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const handleCreate = async (formData: Omit<SalesOrder, 'id' | 'createdAt'>) => {
    await createMutation.mutateAsync(formData);
    setIsAddDialogOpen(false);
  };

  const handleStatusChange = async (orderId: string, newStatus: SalesOrder['status']) => {
    await updateMutation.mutateAsync({
      id: orderId,
      data: { status: newStatus },
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: SalesOrder['status']) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'processing':
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <Package className="w-3 h-3 mr-1" />
            Processing
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Orders</h2>
          <p className="text-gray-500 mt-1">
            Manage customer orders and track status
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Order
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Order</DialogTitle>
            </DialogHeader>
            <SalesOrderForm 
              onSubmit={handleCreate}
              isSubmitting={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        
        {isFetching && !isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Refreshing...</span>
          </div>
        )}
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Order List
            {data && (
              <span className="text-sm font-normal text-gray-500">
                ({data.total} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No orders found</p>
              <p className="text-sm">Create a new order to get started</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: SalesOrder & { _optimistic?: boolean }) => (
                    <TableRow 
                      key={order.id}
                      className={order.id.startsWith('temp-') ? 'opacity-70' : ''}
                    >
                      <TableCell className="font-mono text-sm">
                        #{order.id.split('-')[1]}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customerName}</p>
                          {order.id.startsWith('temp-') && (
                            <span className="text-xs text-blue-500 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Saving...
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{order.items} items</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(order.total)}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={order.status}
                          onValueChange={(value) => 
                            handleStatusChange(order.id, value as SalesOrder['status'])
                          }
                          disabled={updateMutation.isPending}
                        >
                          <SelectTrigger className="w-[140px]">
                            {getStatusBadge(order.status)}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">
                              <span className="flex items-center gap-2">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            </SelectItem>
                            <SelectItem value="processing">
                              <span className="flex items-center gap-2">
                                <Package className="w-3 h-3" /> Processing
                              </span>
                            </SelectItem>
                            <SelectItem value="completed">
                              <span className="flex items-center gap-2">
                                <CheckCircle className="w-3 h-3" /> Completed
                              </span>
                            </SelectItem>
                            <SelectItem value="cancelled">
                              <span className="flex items-center gap-2">
                                <XCircle className="w-3 h-3" /> Cancelled
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
