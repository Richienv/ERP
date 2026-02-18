"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createManualMovement } from "@/app/actions/inventory";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft, Plus, Minus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { NB } from "@/lib/dialog-styles";

interface ManualMovementDialogProps {
  products: { id: string; name: string; code: string }[];
  warehouses: { id: string; name: string }[];
  userId?: string;
}

export function ManualMovementDialog({ products, warehouses, userId = "system-user" }: ManualMovementDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const [type, setType] = useState<"ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "TRANSFER" | "SCRAP">("ADJUSTMENT_IN");
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [targetWarehouseId, setTargetWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (!productId || !warehouseId || !quantity) {
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
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all });
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={NB.triggerBtn}>
          <ArrowRightLeft className="mr-2 h-4 w-4" /> Manual Movement
        </Button>
      </DialogTrigger>
      <DialogContent className={NB.content}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <ArrowRightLeft className="h-5 w-5" /> Record Stock Movement
          </DialogTitle>
          <p className={NB.subtitle}>Adjust stock levels atau transfer antar gudang.</p>
        </DialogHeader>

        <ScrollArea className={NB.scroll}>
          <div className="p-5 space-y-4">
            {/* Movement Type & Product */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 ${typeTone}`}>
                <ArrowRightLeft className="h-4 w-4" />
                <span className={NB.sectionTitle}>Tipe & Produk</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={NB.label}>Movement Type <span className={NB.labelRequired}>*</span></label>
                    <Select value={type} onValueChange={(val: any) => setType(val)}>
                      <SelectTrigger className={NB.select}>
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
                    <label className={NB.label}>Product <span className={NB.labelRequired}>*</span></label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger className={NB.select}>
                        <SelectValue placeholder="Select Product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="font-bold">{p.code}</span> - {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Warehouse & Quantity */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
                <span className={NB.sectionTitle}>Gudang & Jumlah</span>
              </div>
              <div className={NB.sectionBody}>
                <div className={`grid ${type === "TRANSFER" ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
                  <div>
                    <label className={NB.label}>
                      {type === "TRANSFER" ? "From Warehouse" : "Warehouse"} <span className={NB.labelRequired}>*</span>
                    </label>
                    <Select value={warehouseId} onValueChange={setWarehouseId}>
                      <SelectTrigger className={NB.select}>
                        <SelectValue placeholder="Select Warehouse" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w) => (
                          <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {type === "TRANSFER" && (
                    <div>
                      <label className={NB.label}>To Warehouse <span className={NB.labelRequired}>*</span></label>
                      <Select value={targetWarehouseId} onValueChange={setTargetWarehouseId}>
                        <SelectTrigger className={NB.select}>
                          <SelectValue placeholder="Select Target" />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses
                            .filter((w) => w.id !== warehouseId)
                            .map((w) => (
                              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={NB.label}>Quantity <span className={NB.labelRequired}>*</span></label>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className={NB.inputMono}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className={NB.label}>Notes</label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className={NB.textarea + " min-h-[40px]"}
                      placeholder="Reason for movement..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={NB.footer}>
              <Button variant="outline" className={NB.cancelBtn} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button className={NB.submitBtn} disabled={loading} onClick={handleSubmit}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  "Confirm Movement"
                )}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
