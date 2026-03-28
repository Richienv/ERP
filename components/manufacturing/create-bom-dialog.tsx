"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Package, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
  NBSection,
  NBSelect,
  NBInput,
} from "@/components/ui/nb-dialog";

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
  const queryClient = useQueryClient();
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
        toast.error("Failed to load products", { className: "font-bold border-2 border-black rounded-none" });
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
      toast.error("Pilih produk jadi terlebih dahulu", { className: "font-bold border-2 border-black rounded-none" });
      return;
    }

    const validLines = lines.filter((line) => line.materialId && Number(line.quantity) > 0);
    if (validLines.length === 0) {
      toast.error("Minimal satu material diperlukan", { className: "font-bold border-2 border-black rounded-none" });
      return;
    }

    const duplicated = new Set<string>();
    for (const line of validLines) {
      if (duplicated.has(line.materialId)) {
        toast.error("Material duplikat tidak diperbolehkan", { className: "font-bold border-2 border-black rounded-none" });
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
        toast.error(payload.error || (mode === "edit" ? "Gagal memperbarui BOM" : "Gagal membuat BOM"), {
          className: "font-bold border-2 border-black rounded-none"
        });
        return;
      }

      toast.success(mode === "edit" ? "BOM berhasil diperbarui" : "BOM berhasil dibuat", {
        className: "font-bold border-2 border-black rounded-none"
      });
      resetForm();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.bom.all });
      if (onCreated) await onCreated();
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan jaringan", { className: "font-bold border-2 border-black rounded-none" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NBDialog open={open} onOpenChange={onOpenChange} size="wide">
      <NBDialogHeader
        icon={Wrench}
        title={mode === "edit" ? "Edit Bill of Materials" : "Buat Bill of Materials"}
        subtitle="Definisikan komponen material untuk produk jadi"
      />

      <NBDialogBody>
        {/* Product & Version Section */}
        <NBSection icon={Package} title="Produk & Versi">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <NBSelect
              label="Produk Jadi"
              required
              value={productId}
              onValueChange={setProductId}
              placeholder={loadingOptions ? "Memuat..." : "Pilih produk"}
              disabled={loadingOptions || mode === "edit"}
            >
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="font-mono text-[10px] text-muted-foreground mr-2 font-bold">{p.code}</span>
                  {p.name}
                </SelectItem>
              ))}
            </NBSelect>

            <NBInput
              label="Versi"
              value={version}
              onChange={setVersion}
              placeholder="v1"
              className="w-20"
            />

            <NBSelect
              label="Status"
              value={isActive ? "ACTIVE" : "INACTIVE"}
              onValueChange={(value) => setIsActive(value === "ACTIVE")}
              options={[
                { value: "ACTIVE", label: "Aktif" },
                { value: "INACTIVE", label: "Nonaktif" },
              ]}
              className="w-28"
            />
          </div>
          {selectedProduct && (
            <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest mt-1">
              {selectedProduct.code} &middot; {selectedProduct.name}
            </p>
          )}
        </NBSection>

        {/* Material Lines - complex table stays as-is */}
        <NBSection icon={Wrench} title="Material / Komponen">
          <div className="flex items-center justify-end -mt-1 mb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
              className="border border-zinc-300 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-3 h-7 rounded-none"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Tambah
            </Button>
          </div>

          {lines.length === 0 ? (
            <div className="border border-dashed border-zinc-300 p-8 text-center">
              <Package className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3">
                Belum ada material
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLine}
                className="border border-zinc-300 font-bold uppercase text-[10px] tracking-wider rounded-none h-8 px-4"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Material
              </Button>
            </div>
          ) : (
            <div className="border border-zinc-200 overflow-hidden">
              {/* Column headers */}
              <div className="hidden sm:grid grid-cols-[1fr_80px_60px_60px_40px] gap-0 bg-zinc-800 text-white">
                <div className="p-2 text-[10px] font-black uppercase tracking-widest border-r border-zinc-700">Material</div>
                <div className="p-2 text-[10px] font-black uppercase tracking-widest border-r border-zinc-700 text-center">Qty</div>
                <div className="p-2 text-[10px] font-black uppercase tracking-widest border-r border-zinc-700 text-center">Unit</div>
                <div className="p-2 text-[10px] font-black uppercase tracking-widest border-r border-zinc-700 text-center">Waste%</div>
                <div className="p-2" />
              </div>

              {lines.map((line, index) => (
                <div
                  key={index}
                  className={cn(
                    "grid grid-cols-1 sm:grid-cols-[1fr_80px_60px_60px_40px] gap-0 items-center border-b border-zinc-200 last:border-b-0",
                    index % 2 === 0 ? "bg-white" : "bg-zinc-50"
                  )}
                >
                  <div className="p-2 border-b sm:border-b-0 sm:border-r border-zinc-200 h-full flex flex-col justify-center">
                    <Select value={line.materialId} onValueChange={(value) => updateMaterial(index, value)}>
                      <SelectTrigger className="text-xs border-none font-bold bg-transparent h-8 p-0 focus:ring-0 focus:ring-offset-0 px-2 rounded-none">
                        <SelectValue placeholder="Pilih Material..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {materialOptions.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            <span className="font-mono text-[10px] text-muted-foreground mr-1.5 font-bold">{m.code}</span>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="p-2 border-b sm:border-b-0 sm:border-r border-zinc-200 h-full flex flex-col justify-center">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
                      className="text-xs border-none font-bold text-center bg-transparent h-8 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none w-full"
                      placeholder="0"
                    />
                  </div>

                  <div className="p-2 border-b sm:border-b-0 sm:border-r border-zinc-200 h-full flex flex-col justify-center">
                    <div className="text-xs font-mono font-bold text-center text-muted-foreground py-1 bg-zinc-100/50 h-full flex items-center justify-center">
                      {line.unit || "-"}
                    </div>
                  </div>

                  <div className="p-2 border-b sm:border-b-0 sm:border-r border-zinc-200 h-full flex flex-col justify-center">
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={line.wastePct}
                      onChange={(e) => updateLine(index, { wastePct: e.target.value })}
                      className="text-xs border-none font-bold text-center bg-transparent h-8 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none w-full"
                      placeholder="0"
                    />
                  </div>

                  <div className="p-2 flex items-center justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-none transition-colors"
                      onClick={() => removeLine(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </NBSection>
      </NBDialogBody>

      <NBDialogFooter
        onCancel={() => onOpenChange(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        disabled={!productId}
        submitLabel={mode === "edit" ? "Simpan BOM" : "Buat BOM"}
      />
    </NBDialog>
  );
}
