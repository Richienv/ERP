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
import { createWarehouse, updateWarehouse } from "@/app/actions/inventory";
import { toast } from "sonner";
import { Edit, Plus, Warehouse } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

const WAREHOUSE_TYPE_OPTIONS = [
  { value: "RAW_MATERIAL", label: "Bahan Baku" },
  { value: "WORK_IN_PROGRESS", label: "WIP" },
  { value: "FINISHED_GOODS", label: "Barang Jadi" },
  { value: "GENERAL", label: "Umum" },
] as const;

interface WarehouseFormDialogProps {
  mode: "create" | "edit";
  warehouse?: {
    id: string;
    name: string;
    code: string;
    address: string;
    capacity?: number;
    warehouseType?: string;
  };
  trigger?: React.ReactNode;
}

export function WarehouseFormDialog({ mode, warehouse, trigger }: WarehouseFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: warehouse?.name || "",
    code: warehouse?.code || "",
    address: warehouse?.address || "",
    capacity: warehouse?.capacity || 10000,
    warehouseType: warehouse?.warehouseType || "GENERAL",
  });

  // Reset form data when dialog opens or warehouse prop changes
  useEffect(() => {
    if (open) {
      if (mode === "edit" && warehouse) {
        setFormData({
          name: warehouse.name,
          code: warehouse.code,
          address: warehouse.address,
          capacity: warehouse.capacity || 10000,
          warehouseType: warehouse.warehouseType || "GENERAL",
        });
      } else if (mode === "create") {
        setFormData({ name: "", code: "", address: "", capacity: 10000, warehouseType: "GENERAL" });
      }
    }
  }, [open, warehouse?.id, mode]);

  const handleSubmit = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error("Kode dan nama gudang wajib diisi")
      return
    }
    if (formData.capacity < 0) formData.capacity = 0
    setLoading(true);
    try {
      let result;
      if (mode === "create") {
        result = await createWarehouse(formData);
      } else {
        if (!warehouse?.id) return;
        result = await updateWarehouse(warehouse.id, formData);
      }

      if (result.success) {
        toast.success(mode === "create" ? "Warehouse created!" : "Warehouse updated!");
        setOpen(false);
        if (mode === "create") {
          setFormData({ name: "", code: "", address: "", capacity: 10000, warehouseType: "GENERAL" });
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all });
      } else {
        toast.error("Operation failed", { description: result.error });
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className={mode === "create"
            ? "bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
            : "border border-zinc-300 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
          }
        >
          {mode === "create" ? <Plus className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
          {mode === "create" ? "Add Warehouse" : "Edit Configuration"}
        </Button>
      )}

      <NBDialog open={open} onOpenChange={setOpen} size="narrow">
        <NBDialogHeader
          icon={Warehouse}
          title={mode === "create" ? "Create Warehouse" : "Edit Warehouse"}
          subtitle={mode === "create" ? "Tambah lokasi gudang baru." : "Update konfigurasi gudang."}
        />

        <NBDialogBody>
          <NBSection icon={Warehouse} title="Detail Gudang">
            <div className="grid grid-cols-2 gap-3">
              <NBInput
                label="Warehouse Code"
                required
                value={formData.code}
                onChange={(v) => setFormData({ ...formData, code: v })}
                placeholder="WH-001"
              />
              <NBInput
                label="Warehouse Name"
                required
                value={formData.name}
                onChange={(v) => setFormData({ ...formData, name: v })}
                placeholder="Central Distribution Hub"
              />
            </div>
            <NBInput
              label="Full Address"
              value={formData.address}
              onChange={(v) => setFormData({ ...formData, address: v })}
              placeholder="Street, City, Province"
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
          onSubmit={handleSubmit}
          submitting={loading}
          submitLabel={mode === "create" ? "Create Warehouse" : "Save Changes"}
        />
      </NBDialog>
    </>
  );
}
