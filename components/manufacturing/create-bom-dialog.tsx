"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ProductOption {
  id: string;
  code: string;
  name: string;
  unit: string;
}

interface BOMLine {
  materialId: string;
  quantity: string;
  unit: string;
  wastePct: string;
}

interface EditableBOM {
  id: string;
  productId: string;
  version: string;
  isActive: boolean;
  items: Array<{
    materialId: string;
    quantity: number;
    unit?: string | null;
    wastePct: number;
  }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => Promise<void> | void;
  mode?: "create" | "edit";
  initialBOM?: EditableBOM | null;
}

export function CreateBOMDialog({ open, onOpenChange, onCreated, mode = "create", initialBOM = null }: Props) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [productId, setProductId] = useState("");
  const [version, setVersion] = useState("v1");
  const [isActive, setIsActive] = useState(true);
  const [lines, setLines] = useState<BOMLine[]>([{ materialId: "", quantity: "1", unit: "", wastePct: "0" }]);

  useEffect(() => {
    if (!open) return;

    const loadProducts = async () => {
      setLoadingOptions(true);
      try {
        const response = await fetch("/api/products?limit=500&status=active");
        const payload = await response.json();
        if (payload.success) {
          setProducts(
            (payload.data || []).map((p: any) => ({
              id: p.id,
              code: p.code,
              name: p.name,
              unit: p.unit,
            }))
          );
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load products");
      } finally {
        setLoadingOptions(false);
      }
    };

    loadProducts();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialBOM) {
      setProductId(initialBOM.productId);
      setVersion(initialBOM.version || "v1");
      setIsActive(initialBOM.isActive);
      const mappedLines = initialBOM.items.length > 0
        ? initialBOM.items.map((item) => ({
            materialId: item.materialId,
            quantity: String(item.quantity),
            unit: item.unit || "",
            wastePct: String(item.wastePct ?? 0),
          }))
        : [{ materialId: "", quantity: "1", unit: "", wastePct: "0" }];
      setLines(mappedLines);
      return;
    }
    setProductId("");
    setVersion("v1");
    setIsActive(true);
    setLines([{ materialId: "", quantity: "1", unit: "", wastePct: "0" }]);
  }, [open, mode, initialBOM]);

  const materialOptions = useMemo(() => products.filter((p) => p.id !== productId), [products, productId]);
  const selectedProduct = useMemo(() => products.find((p) => p.id === productId) || null, [products, productId]);

  const updateLine = (index: number, patch: Partial<BOMLine>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const updateMaterial = (index: number, materialId: string) => {
    const selected = materialOptions.find((m) => m.id === materialId);
    updateLine(index, {
      materialId,
      unit: selected?.unit || "",
    });
  };

  const addLine = () => setLines((prev) => [...prev, { materialId: "", quantity: "1", unit: "", wastePct: "0" }]);
  const removeLine = (index: number) => setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const resetForm = () => {
    setProductId("");
    setVersion("v1");
    setIsActive(true);
    setLines([{ materialId: "", quantity: "1", unit: "", wastePct: "0" }]);
  };

  const handleSubmit = async () => {
    if (!productId) {
      toast.error("Finished good product is required");
      return;
    }

    const validLines = lines.filter((line) => line.materialId && Number(line.quantity) > 0);
    if (validLines.length === 0) {
      toast.error("At least one material line is required");
      return;
    }

    const duplicated = new Set<string>();
    for (const line of validLines) {
      if (duplicated.has(line.materialId)) {
        toast.error("Duplicate material lines are not allowed");
        return;
      }
      duplicated.add(line.materialId);
    }

    setSubmitting(true);
    try {
      const endpoint = mode === "edit" && initialBOM?.id
        ? `/api/manufacturing/bom/${initialBOM.id}`
        : "/api/manufacturing/bom";

      const response = await fetch(endpoint, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          version: version || "v1",
          isActive,
          items: validLines.map((line) => ({
            materialId: line.materialId,
            quantity: Number(line.quantity),
            unit: line.unit || undefined,
            wastePct: Number(line.wastePct || 0),
          })),
        }),
      });

      const payload = await response.json();
      if (!payload.success) {
        toast.error(payload.error || (mode === "edit" ? "Failed to update BOM" : "Failed to create BOM"));
        return;
      }

      toast.success(mode === "edit" ? "BOM updated successfully" : "BOM created successfully");
      resetForm();
      onOpenChange(false);
      if (onCreated) await onCreated();
    } catch (error) {
      console.error(error);
      toast.error(mode === "edit" ? "Network error while updating BOM" : "Network error while creating BOM");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b bg-white">
          <DialogTitle className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight">
            {mode === "edit" ? "Edit Bill Of Materials" : "Create Bill Of Materials"}
          </DialogTitle>
          <DialogDescription className="text-sm">Use options-driven input to avoid manual unit mismatch and data inconsistencies.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[72vh] overflow-y-auto px-6 py-5 space-y-5 bg-zinc-50/40">
          <div className="rounded-xl border border-black/15 bg-zinc-50/50 p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="space-y-1.5 min-w-0 md:col-span-7">
                <Label>Finished Good Product</Label>
                <Select value={productId} onValueChange={setProductId} disabled={loadingOptions || mode === "edit"}>
                  <SelectTrigger className="h-12 bg-white min-w-0 [&>span]:truncate">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <span className="block truncate">{product.code} - {product.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProduct ? (
                  <p className="text-[11px] text-zinc-500 truncate">
                    {selectedProduct.code} - {selectedProduct.name}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5 min-w-0 md:col-span-2">
                <Label>Version</Label>
                <Input
                  className="h-12 bg-white"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="v1"
                />
              </div>
              <div className="space-y-1.5 min-w-0 md:col-span-3">
                <Label>Status</Label>
                <Select value={isActive ? "ACTIVE" : "INACTIVE"} onValueChange={(value) => setIsActive(value === "ACTIVE")}>
                  <SelectTrigger className="h-12 bg-white min-w-0 [&>span]:truncate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-black/20 p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-wide">Material Lines</p>
              <Button type="button" size="sm" variant="outline" className="border-black" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" /> Add Line
              </Button>
            </div>

            {lines.map((line, index) => (
              <div key={index} className="rounded-lg border border-zinc-200 p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-zinc-50/50">
                <div className="sm:col-span-5 space-y-1.5 min-w-0">
                  <Label>Material</Label>
                  <Select value={line.materialId} onValueChange={(value) => updateMaterial(index, value)}>
                    <SelectTrigger className="h-11 bg-white min-w-0 [&>span]:truncate">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materialOptions.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          <span className="block truncate">{material.code} - {material.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-1.5 min-w-0">
                  <Label>Qty</Label>
                  <Input
                    className="h-11 bg-white"
                    type="number"
                    min={0.0001}
                    step="0.0001"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5 min-w-0">
                  <Label>Unit</Label>
                  <Input value={line.unit || "-"} readOnly className="h-11 bg-zinc-100" />
                </div>
                <div className="sm:col-span-2 space-y-1.5 min-w-0">
                  <Label>Waste %</Label>
                  <Input
                    className="h-11 bg-white"
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.wastePct}
                    onChange={(e) => updateLine(index, { wastePct: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-1">
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 border-red-300 text-red-600" onClick={() => removeLine(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-zinc-50 flex gap-2">
          <Button variant="outline" className="flex-1 border-black" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 bg-black text-white hover:bg-zinc-800" disabled={submitting} onClick={handleSubmit}>
            {submitting ? (mode === "edit" ? "Saving..." : "Creating...") : (mode === "edit" ? "Save BOM" : "Create BOM")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
