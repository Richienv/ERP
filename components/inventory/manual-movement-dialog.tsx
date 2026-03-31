"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
  NBSection,
  NBInput,
  NBSelect,
  NBTextarea,
} from "@/components/ui/nb-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createManualMovement } from "@/app/actions/inventory";
import { toast } from "sonner";
import { ArrowRightLeft, Plus, Minus, Trash2, Warehouse } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create";

interface ManualMovementDialogProps {
  products: { id: string; name: string; code: string }[];
  warehouses: { id: string; name: string }[];
  userId?: string;
}

export function ManualMovementDialog({ products, warehouses, userId = "system-user" }: ManualMovementDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const productOptions = useMemo(() =>
    products.map(p => ({ value: p.id, label: p.name, subtitle: p.code })), [products]);

  const [type, setType] = useState<"ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "TRANSFER" | "SCRAP">("ADJUSTMENT_IN");
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (!productId || !warehouseId || !quantity || Number(quantity) <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (type === "TRANSFER" && !targetWarehouseId) {
      toast.error("Please select a target warehouse");
      return;
    }

    if (type === "TRANSFER" && warehouseId === targetWarehouseId) {
      toast.error("Source and Target warehouse cannot be the same");
      return;
    }

    setLoading(true);
    try {
      const result = await createManualMovement({
        type,
        productId,
        warehouseId,
        targetWarehouseId: type === "TRANSFER" ? targetWarehouseId : undefined,
        quantity: Number(quantity),
        notes,
        userId,
      });

      if (result.success) {
        toast.success("Movement recorded successfully");
        setOpen(false);
        setQuantity("");
        setNotes("");
        setProductId("");
        setWarehouseId("");
        setTargetWarehouseId("");
        setType("ADJUSTMENT_IN");
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.adjustments.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.stockTransfers.all });
      } else {
        toast.error("error" in result && result.error ? String(result.error) : "Failed to record movement");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const typeTone = type === "ADJUSTMENT_IN"
    ? "border-l-emerald-400 bg-emerald-50"
    : type === "ADJUSTMENT_OUT"
    ? "border-l-amber-400 bg-amber-50"
    : type === "TRANSFER"
    ? "border-l-blue-400 bg-blue-50"
    : "border-l-red-400 bg-red-50";

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
      >
        <ArrowRightLeft className="mr-2 h-4 w-4" /> Manual Movement
      </Button>

      <NBDialog open={open} onOpenChange={setOpen}>
        <NBDialogHeader
          icon={ArrowRightLeft}
          title="Record Stock Movement"
          subtitle="Adjust stock levels atau transfer antar gudang."
        />

        <NBDialogBody>
          {/* Movement Type & Product */}
          <NBSection icon={ArrowRightLeft} title="Tipe & Produk">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                  Movement Type <span className="text-red-500">*</span>
                </label>
                <Select value={type} onValueChange={(val: any) => setType(val)}>
                  <SelectTrigger className="h-8 text-sm rounded-none border border-zinc-300">
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADJUSTMENT_IN">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <Plus className="h-3.5 w-3.5" /> Adjustment IN
                      </div>
                    </SelectItem>
                    <SelectItem value="ADJUSTMENT_OUT">
                      <div className="flex items-center gap-2 text-amber-700">
                        <Minus className="h-3.5 w-3.5" /> Adjustment OUT
                      </div>
                    </SelectItem>
                    <SelectItem value="TRANSFER">
                      <div className="flex items-center gap-2 text-blue-700">
                        <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
                      </div>
                    </SelectItem>
                    <SelectItem value="SCRAP">
                      <div className="flex items-center gap-2 text-red-700">
                        <Trash2 className="h-3.5 w-3.5" /> Scrap / Damage
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                  Product <span className="text-red-500">*</span>
                </label>
                <ComboboxWithCreate
                  options={productOptions}
                  value={productId}
                  onChange={setProductId}
                  placeholder="Pilih produk..."
                  searchPlaceholder="Cari produk..."
                  emptyMessage="Produk tidak ditemukan."
                />
              </div>
            </div>
          </NBSection>

          {/* Warehouse & Quantity */}
          <NBSection icon={Warehouse} title="Gudang & Jumlah">
            <div className={`grid ${type === "TRANSFER" ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
              <NBSelect
                label={type === "TRANSFER" ? "From Warehouse" : "Warehouse"}
                required
                value={warehouseId}
                onValueChange={setWarehouseId}
                placeholder="Select Warehouse"
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
              />
              {type === "TRANSFER" && (
                <NBSelect
                  label="To Warehouse"
                  required
                  value={targetWarehouseId}
                  onValueChange={setTargetWarehouseId}
                  placeholder="Select Target"
                  options={warehouses
                    .filter((w) => w.id !== warehouseId)
                    .map((w) => ({ value: w.id, label: w.name }))}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NBInput
                label="Quantity"
                required
                type="number"
                value={quantity}
                onChange={setQuantity}
                placeholder="0"
              />
              <NBTextarea
                label="Notes"
                value={notes}
                onChange={setNotes}
                placeholder="Reason for movement..."
                rows={2}
              />
            </div>
          </NBSection>
        </NBDialogBody>

        <NBDialogFooter
          onCancel={() => setOpen(false)}
          onSubmit={handleSubmit}
          submitting={loading}
          submitLabel="Confirm Movement"
        />
      </NBDialog>
    </>
  );
}
