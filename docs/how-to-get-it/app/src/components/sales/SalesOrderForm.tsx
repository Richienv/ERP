import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { SalesOrder } from '@/lib/api';

interface SalesOrderFormProps {
  onSubmit: (data: Omit<SalesOrder, 'id' | 'createdAt'>) => void;
  isSubmitting?: boolean;
}

const customerNames = [
  'Acme Corp',
  'TechStart Inc',
  'Global Solutions',
  'Digital Dynamics',
  'Future Systems',
  'Smart Industries',
  'NextGen Co',
  'Prime Ventures',
];

export function SalesOrderForm({ onSubmit, isSubmitting }: SalesOrderFormProps) {
  const [formData, setFormData] = useState({
    customerName: '',
    items: '',
    total: '',
    status: 'pending' as SalesOrder['status'],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      customerName: formData.customerName,
      items: parseInt(formData.items),
      total: parseFloat(formData.total),
      status: formData.status,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="customerName">Customer Name</Label>
        <Select
          value={formData.customerName}
          onValueChange={(value) => setFormData({ ...formData, customerName: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select customer" />
          </SelectTrigger>
          <SelectContent>
            {customerNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="items">Number of Items</Label>
          <Input
            id="items"
            type="number"
            min="1"
            value={formData.items}
            onChange={(e) => setFormData({ ...formData, items: e.target.value })}
            placeholder="1"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="total">Total Amount ($)</Label>
          <Input
            id="total"
            type="number"
            min="0"
            step="0.01"
            value={formData.total}
            onChange={(e) => setFormData({ ...formData, total: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Initial Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => setFormData({ ...formData, status: value as SalesOrder['status'] })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Create Order
        </Button>
      </div>
    </form>
  );
}
