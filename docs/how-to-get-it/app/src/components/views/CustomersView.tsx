import { useState } from 'react';
import { Users, Mail, Phone, ShoppingBag, DollarSign, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCustomers } from '@/hooks/useCustomers';
import { Button } from '@/components/ui/button';
import type { Customer } from '@/lib/api';

// ============================================
// CUSTOMERS VIEW
// ============================================

export function CustomersView() {
  const [page, setPage] = useState(1);
  
  const { data, isLoading, isFetching } = useCustomers({ page, limit: 12 });
  
  const customers = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Customers</h2>
          <p className="text-gray-500 mt-1">
            View and manage your customer base
          </p>
        </div>
        
        {isFetching && !isLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Refreshing...</span>
          </div>
        )}
      </div>

      {/* Customers Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No customers found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map((customer: Customer) => (
              <Card key={customer.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-lg">
                        {customer.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {customer.name}
                      </h3>
                      
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Mail className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Phone className="w-4 h-4 flex-shrink-0" />
                          <span>{customer.phone}</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-sm">
                          <ShoppingBag className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">{customer.totalOrders}</span>
                          <span className="text-gray-500">orders</span>
                        </div>
                        
                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span className="font-medium text-green-600">
                            {formatCurrency(customer.totalSpent)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
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
    </div>
  );
}
