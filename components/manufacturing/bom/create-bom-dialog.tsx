"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Loader2, Package, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NB } from "@/lib/dialog-styles";

interface Product {
  id: string;
  code: string;
  name: string;
  unit: string;
}

interface MaterialLine {
  id: string;
  materialId: string;
  quantity: string;
  unit: string;
  wastePct: string;
}

interface CreateBOMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateBOMDialog({ open, onOpenChange, onCreated }: CreateBOMDialogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [productId, setProductId] = useState("");
  const [version, setVersion] = useState("v1");
  const [status, setStatus] = useState("true");
  const [lines, setLines] = useState<MaterialLine[]>([]);

  useEffect(() => {
    if (open) {
      fetchProducts();
      setProductId("");
      setVersion("v1");
      setStatus("true");
      setLines([]);
    }
  }, [open]);

  async function fetchProducts() {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products?limit=500&status=active");
      const data = await res.json();
      if (data.success !== false) {
        const productList = data.data || data.products || data;
        if (Array.isArray(productList)) {
          setProducts(
            productList.map((p: any) => ({
              id: p.id,
              code: p.code,
              name: p.name,
              unit: p.unit,
            }))
          );
        }
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoadingProducts(false);
    }
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        materialId: "",
        quantity: "1",
        unit: "",
        wastePct: "0",
      },
    ]);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLine(id: string, field: keyof MaterialLine, value: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        if (field === "materialId") {
          const product = products.find((p) => p.id === value);
          if (product) updated.unit = product.unit;
        }
        return updated;
      })
    );
  }

  const finishedGoodProducts = products;
  const materialProducts = products.filter((p) => p.id !== productId);

  async function handleSubmit() {
    if (!productId) {
      toast.error("Pilih produk jadi terlebih dahulu");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/manufacturing/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          version,
          items: lines
            .filter((l) => l.materialId)
            .map((l) => ({
              materialId: l.materialId,
              quantity: l.quantity,
              unit: l.unit || null,
              wastePct: l.wastePct,
            })),
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Bill of Materials berhasil dibuat");
        onOpenChange(false);
        onCreated();
      } else {
        toast.error(data.error || "Gagal membuat BOM");
      }
    } catch (error) {
      console.error("Error creating BOM:", error);
      toast.error("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={NB.contentWide}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <Wrench className="h-5 w-5" /> Buat Bill of Materials
          </DialogTitle>
          <p className={NB.subtitle}>Definisikan komponen material untuk produk jadi</p>
        </DialogHeader>

        <ScrollArea className={NB.scroll}>
          <div className="p-5 space-y-4">
            {/* Product & Version */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                <Wrench className="h-4 w-4" />
                <span className={NB.sectionTitle}>Produk Jadi</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-end">
                  <div>
                    <label className={NB.label}>
                      Produk Jadi <span className={NB.labelRequired}>*</span>
                    </label>
                    <Select value={productId} onValueChange={setProductId}>
                      <SelectTrigger className={NB.select}>
                        <SelectValue placeholder={loadingProducts ? "Memuat..." : "Pilih produk"} />
                      </SelectTrigger>
                      <SelectContent>
                        {finishedGoodProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="font-mono text-[10px] text-zinc-400 mr-2 font-bold">{p.code}</span>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={NB.label}>Versi</label>
                    <Input value={version} onChange={(e) => setVersion(e.target.value)} className={NB.inputMono + " w-20 text-center"} />
                  </div>
                  <div>
                    <label className={NB.label}>Status</label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className={NB.select + " w-28"}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Aktif</SelectItem>
                        <SelectItem value="false">Nonaktif</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Material Lines */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                <Package className="h-4 w-4" />
                <span className={NB.sectionTitle}>Material / Komponen</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 text-[10px] font-black uppercase tracking-wider border-2 border-black"
                  onClick={addLine}
                >
                  <Plus className="h-3 w-3 mr-1" /> Tambah
                </Button>
              </div>

              {lines.length === 0 ? (
                <div className="border-t-0 p-8 text-center bg-zinc-50">
                  <div className="h-14 w-14 mx-auto bg-zinc-100 border-2 border-black flex items-center justify-center mb-3">
                    <Package className="h-7 w-7 text-zinc-400" />
                  </div>
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Belum ada material</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addLine}
                    className="border-2 border-black text-[10px] font-black uppercase tracking-wider"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah Material
                  </Button>
                </div>
              ) : (
                <div>
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_80px_80px_80px_36px] gap-2 bg-black text-white p-3">
                    <span className="text-[10px] font-black uppercase tracking-widest">Material</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Qty</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Satuan</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Waste%</span>
                    <span />
                  </div>

                  {lines.map((line, i) => (
                    <div
                      key={line.id}
                      className={cn(
                        "grid grid-cols-[1fr_80px_80px_80px_36px] gap-2 items-center p-2 border-b-2 border-black",
                        i % 2 === 0 ? "bg-white" : "bg-zinc-50/50"
                      )}
                    >
                      <Select value={line.materialId} onValueChange={(v) => updateLine(line.id, "materialId", v)}>
                        <SelectTrigger className="text-xs border-2 border-black font-bold bg-white h-9">
                          <SelectValue placeholder="Pilih" />
                        </SelectTrigger>
                        <SelectContent>
                          {materialProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              <span className="font-mono text-[10px] text-zinc-400 mr-1.5 font-bold">{p.code}</span>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                        className="text-xs border-2 border-black font-bold text-center bg-white h-9"
                      />
                      <Input
                        value={line.unit}
                        onChange={(e) => updateLine(line.id, "unit", e.target.value)}
                        className="text-xs border-2 border-black font-bold text-center bg-zinc-100 h-9"
                        readOnly
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={line.wastePct}
                        onChange={(e) => updateLine(line.id, "wastePct", e.target.value)}
                        className="text-xs border-2 border-black font-bold text-center bg-white h-9"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 border-2 border-red-300 text-red-600 hover:bg-red-50"
                        onClick={() => removeLine(line.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={NB.footer}>
              <Button variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)} disabled={submitting}>
                Batal
              </Button>
              <Button className={NB.submitBtn} onClick={handleSubmit} disabled={submitting || !productId}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : "Buat BOM"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
