"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
  NBSection,
  NBInput,
  NBSelect,
} from "@/components/ui/nb-dialog";
import { updateWarehouse } from "@/app/actions/inventory";
import { toast } from "sonner";
import { Edit, Warehouse } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

const WAREHOUSE_TYPE_OPTIONS = [
  { value: "RAW_MATERIAL", label: "Bahan Baku" },
  { value: "WORK_IN_PROGRESS", label: "WIP" },
  { value: "FINISHED_GOODS", label: "Barang Jadi" },
  { value: "GENERAL", label: "Umum" },
] as const;

interface WarehouseEditDialogProps {
  warehouse: {
    id: string;
    name: string;
    code: string;
    address: string;
    capacity?: number;
    warehouseType?: string;
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
    warehouseType: warehouse.warehouseType || "GENERAL",
  });

  // Reset form data when dialog opens or warehouse prop changes
  useEffect(() => {
    if (open) {
      setFormData({
        name: warehouse.name,
        code: warehouse.code,
        address: warehouse.address,
        capacity: warehouse.capacity || 0,
        warehouseType: warehouse.warehouseType || "GENERAL",
      });
    }
  }, [open, warehouse.id]);

  const handleSave = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Kode dan nama gudang wajib diisi")
      return
    }
    if (formData.capacity < 0) formData.capacity = 0
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
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="border border-zinc-300 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
      >
        <Edit className="mr-2 h-4 w-4" /> Edit Configuration
      </Button>

      <NBDialog open={open} onOpenChange={setOpen} size="narrow">
        <NBDialogHeader
          icon={Warehouse}
          title="Edit Warehouse"
          subtitle="Update konfigurasi dan lokasi gudang."
        />

        <NBDialogBody>
          <NBSection icon={Warehouse} title="Detail Gudang">
            <div className="grid grid-cols-2 gap-3">
              <NBInput
                label="Code"
                value={formData.code}
                onChange={(v) => setFormData({ ...formData, code: v })}
              />
              <NBInput
                label="Name"
                value={formData.name}
                onChange={(v) => setFormData({ ...formData, name: v })}
              />
            </div>
            <NBInput
              label="Full Address"
              value={formData.address}
              onChange={(v) => setFormData({ ...formData, address: v })}
            />
            <div className="grid grid-cols-2 gap-3">
              <NBInput
                label="Max Capacity"
                type="number"
                value={String(formData.capacity)}
                onChange={(v) => setFormData({ ...formData, capacity: Number(v) })}
              />
              <NBSelect
                label="Tipe Gudang"
                value={formData.warehouseType}
                onValueChange={(v) => setFormData({ ...formData, warehouseType: v })}
                options={WAREHOUSE_TYPE_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
              />
            </div>
          </NBSection>
        </NBDialogBody>

        <NBDialogFooter
          onCancel={() => setOpen(false)}
          onSubmit={handleSave}
          submitting={loading}
          submitLabel="Save Changes"
        />
      </NBDialog>
    </>
  );
}
