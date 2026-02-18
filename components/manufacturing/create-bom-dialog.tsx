"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Loader2, Package, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none gap-0">
        {/* Neo-Brutalist Header */}
        <div className="bg-black text-white px-6 pt-6 pb-4 shrink-0 border-b-2 border-black">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              <div className="h-10 w-10 bg-white text-black flex items-center justify-center border-2 border-white rounded-none">
                <Wrench className="h-5 w-5" />
              </div>
              {mode === "edit" ? "Edit Bill of Materials" : "Buat Bill of Materials"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400 font-medium text-xs uppercase tracking-wide mt-2">
              Definisikan komponen material untuk produk jadi
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable body */}
        <ScrollArea className="flex-1 min-h-0 bg-white">
          <div className="px-6 py-5 space-y-6">
            {/* Product selection row */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Produk Jadi *</Label>
                <Select value={productId} onValueChange={setProductId} disabled={loadingOptions || mode === "edit"}>
                  <SelectTrigger className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-bold bg-white dark:bg-zinc-900 h-11 rounded-none focus:ring-0 focus:ring-offset-0">
                    <SelectValue placeholder={loadingOptions ? "Memuat..." : "Pilih produk"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="font-medium focus:bg-zinc-100 rounded-none cursor-pointer">
                        <span className="font-mono text-[10px] text-muted-foreground mr-2 font-bold">{p.code}</span>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProduct && (
                  <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
                    {selectedProduct.code} &middot; {selectedProduct.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Versi</Label>
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-20 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-bold text-center bg-white dark:bg-zinc-900 h-11 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="v1"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</Label>
                <Select value={isActive ? "ACTIVE" : "INACTIVE"} onValueChange={(value) => setIsActive(value === "ACTIVE")}>
                  <SelectTrigger className="w-28 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] font-bold bg-white dark:bg-zinc-900 h-11 rounded-none focus:ring-0 focus:ring-offset-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                    <SelectItem value="ACTIVE" className="font-bold focus:bg-zinc-100 rounded-none cursor-pointer">Aktif</SelectItem>
                    <SelectItem value="INACTIVE" className="font-bold focus:bg-zinc-100 rounded-none cursor-pointer">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Material lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase tracking-widest text-zinc-500">Material / Komponen</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                  className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-[10px] tracking-wide bg-white active:scale-[0.98] rounded-none h-8"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Tambah
                </Button>
              </div>

              {lines.length === 0 ? (
                <div className="border-2 border-dashed border-black p-8 text-center bg-zinc-50/50">
                  <div className="h-16 w-16 mx-auto bg-zinc-100 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center mb-4 rounded-full">
                    <Package className="h-8 w-8 text-zinc-400" />
                  </div>
                  <p className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wide">
                    Belum ada material
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLine}
                    className="border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-[10px] tracking-wide bg-white active:scale-[0.98] rounded-none h-9 px-4"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Material
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden rounded-none">
                  {/* Column headers */}
                  <div className="hidden sm:grid grid-cols-[1fr_80px_60px_60px_40px] gap-0 bg-black text-white border-b-2 border-black">
                    <div className="p-3 text-[10px] font-black uppercase tracking-widest border-r border-zinc-800">Material</div>
                    <div className="p-3 text-[10px] font-black uppercase tracking-widest border-r border-zinc-800 text-center">Qty</div>
                    <div className="p-3 text-[10px] font-black uppercase tracking-widest border-r border-zinc-800 text-center">Unit</div>
                    <div className="p-3 text-[10px] font-black uppercase tracking-widest border-r border-zinc-800 text-center">Waste%</div>
                    <div className="p-3" />
                  </div>

                  {lines.map((line, index) => (
                    <div
                      key={index}
                      className={cn(
                        "grid grid-cols-1 sm:grid-cols-[1fr_80px_60px_60px_40px] gap-0 items-center border-b-2 border-black last:border-b-0",
                        index % 2 === 0 ? "bg-white" : "bg-zinc-50"
                      )}
                    >
                      <div className="p-2 border-b sm:border-b-0 border-black/10 sm:border-r-2 sm:border-black h-full flex flex-col justify-center">
                        <Label className="text-[9px] font-bold uppercase sm:hidden mb-1">Material</Label>
                        <Select value={line.materialId} onValueChange={(value) => updateMaterial(index, value)}>
                          <SelectTrigger className="text-xs border-none font-bold bg-transparent h-8 p-0 focus:ring-0 focus:ring-offset-0 px-2 rounded-none">
                            <SelectValue placeholder="Pilih Material..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                            {materialOptions.map((m) => (
                              <SelectItem key={m.id} value={m.id} className="font-medium rounded-none py-2 cursor-pointer focus:bg-zinc-100">
                                <span className="font-mono text-[10px] text-muted-foreground mr-1.5 font-bold">{m.code}</span>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="p-2 border-b sm:border-b-0 border-black/10 sm:border-r-2 sm:border-black h-full flex flex-col justify-center">
                        <Label className="text-[9px] font-bold uppercase sm:hidden mb-1">Qty</Label>
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

                      <div className="p-2 border-b sm:border-b-0 border-black/10 sm:border-r-2 sm:border-black h-full flex flex-col justify-center">
                        <Label className="text-[9px] font-bold uppercase sm:hidden mb-1">Satuan</Label>
                        <div className="text-xs font-mono font-bold text-center text-muted-foreground py-1 bg-zinc-100/50 h-full flex items-center justify-center">
                          {line.unit || "-"}
                        </div>
                      </div>

                      <div className="p-2 border-b sm:border-b-0 border-black/10 sm:border-r-2 sm:border-black h-full flex flex-col justify-center">
                        <Label className="text-[9px] font-bold uppercase sm:hidden mb-1">Waste %</Label>
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
                          className="h-8 w-8 text-black hover:text-white hover:bg-red-600 rounded-none transition-colors"
                          onClick={() => removeLine(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Neo-Brutalist Footer */}
        <div className="px-6 py-4 border-t-2 border-black shrink-0 bg-zinc-50 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wide bg-white active:scale-[0.98] rounded-none h-10"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button
            className="flex-1 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] transition-all font-black uppercase text-xs tracking-wide active:scale-[0.98] rounded-none h-10 hover:bg-zinc-800"
            disabled={submitting || !productId}
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting
              ? (mode === "edit" ? "Menyimpan..." : "Membuat...")
              : (mode === "edit" ? "Simpan BOM" : "Buat BOM")
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
