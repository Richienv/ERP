"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { updateWarehouse } from "@/app/actions/inventory";
import { toast } from "sonner";
import { Edit, Loader2, Save, Warehouse } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { NB } from "@/lib/dialog-styles";

interface WarehouseEditDialogProps {
  warehouse: {
    id: string;
    name: string;
    code: string;
    address: string;
    capacity?: number;
  };
}

export function WarehouseEditDialog({ warehouse }: WarehouseEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: warehouse.name,
    code: warehouse.code,
    address: warehouse.address,
    capacity: warehouse.capacity || 0,
  });

  // Reset form data when dialog opens or warehouse prop changes
  useEffect(() => {
    if (open) {
      setFormData({
        name: warehouse.name,
        code: warehouse.code,
        address: warehouse.address,
        capacity: warehouse.capacity || 0,
      });
    }
  }, [open, warehouse.id]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await updateWarehouse(warehouse.id, formData);
      if (result.success) {
        toast.success("Gudang berhasil diperbarui");
        setOpen(false);
        queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all });
      } else {
        toast.error("Failed to update", { description: result.error });
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={NB.cancelBtn}>
          <Edit className="mr-2 h-4 w-4" /> Edit Configuration
        </Button>
      </DialogTrigger>
      <DialogContent className={NB.contentNarrow}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <Warehouse className="h-5 w-5" /> Edit Warehouse
          </DialogTitle>
          <p className={NB.subtitle}>Update konfigurasi dan lokasi gudang.</p>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <div className={NB.section}>
            <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
              <Warehouse className="h-4 w-4" />
              <span className={NB.sectionTitle}>Detail Gudang</span>
            </div>
            <div className={NB.sectionBody}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={NB.label}>Code</label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className={NB.inputMono}
                  />
                </div>
                <div>
                  <label className={NB.label}>Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={NB.input}
                  />
                </div>
              </div>
              <div>
                <label className={NB.label}>Full Address</label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className={NB.input}
                />
              </div>
              <div className="max-w-[200px]">
                <label className={NB.label}>Max Capacity</label>
                <Input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  className={NB.inputMono}
                />
              </div>
            </div>
          </div>

          <div className={NB.footer}>
            <Button variant="outline" className={NB.cancelBtn} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className={NB.submitBtn} disabled={loading} onClick={handleSave}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Save Changes</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
