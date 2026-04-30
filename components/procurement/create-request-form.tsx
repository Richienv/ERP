"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Loader2, UserCheck, StickyNote, Package, Save, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { createPurchaseRequest } from "@/lib/actions/procurement";
import { NB } from "@/lib/dialog-styles";
import { NBSection, NBSelect, NBTextarea } from "@/components/ui/nb-dialog";
import { SelectItem } from "@/components/ui/select";

const itemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  notes: z.string().optional(),
});

const formSchema = z.object({
  requesterId: z.string().min(1, "Requester is required"),
  department: z.string().optional(),
  priority: z.string().default("NORMAL"),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

type FormValues = z.input<typeof formSchema>;
type FormValuesOutput = z.output<typeof formSchema>;

interface Props {
  products: { id: string; name: string; unit: string; code: string }[];
  employees: { id: string; firstName: string; lastName: string | null; department: string }[];
}

export function CreateRequestForm({ products, employees }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newItem, setNewItem] = useState<{ productId: string; quantity: number; notes: string }>({
    productId: "",
    quantity: 1,
    notes: "",
  });

  const form = useForm<FormValues, any, FormValuesOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      requesterId: "",
      priority: "NORMAL",
      notes: "",
      items: [],
    },
  });

  const items = form.watch("items");

  const handleAddItem = () => {
    if (!newItem.productId) {
      toast.error("Pilih produk terlebih dahulu");
      return;
    }
    if (newItem.quantity < 1) {
      toast.error("Jumlah harus lebih dari 0");
      return;
    }
    if (items.some((i) => i.productId === newItem.productId)) {
      toast.error("Item sudah ditambahkan");
      return;
    }
    form.setValue("items", [...items, newItem]);
    setNewItem({ productId: "", quantity: 1, notes: "" });
  };

  const handleRemoveItem = (index: number) => {
    const current = form.getValues("items");
    form.setValue(
      "items",
      current.filter((_, i) => i !== index)
    );
  };

  const onSubmit = async (values: FormValuesOutput) => {
    setIsSubmitting(true);
    try {
      const result = await createPurchaseRequest(values);
      if (result.success) {
        toast.success("Purchase Request berhasil dibuat");
        router.push("/procurement/requests");
        queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.sidebarActions.all });
      } else {
        toast.error(result.error || "Gagal membuat request");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === newItem.productId);

  return (
    <div className="border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden bg-white dark:bg-zinc-900">
      {/* Black Header */}
      <div className="bg-black text-white px-5 py-3">
        <div className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Buat Permintaan Baru
        </div>
        <p className="text-zinc-400 text-[11px] font-bold mt-0.5">
          Draft Purchase Request untuk pengadaan barang
        </p>
      </div>

      {/* Body */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="p-4 space-y-3">
            {/* SECTION 1 — Detail Permintaan */}
            <NBSection icon={UserCheck} title="Detail Permintaan">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="requesterId"
                  render={({ field }) => (
                    <FormItem>
                      <NBSelect
                        label="Pemohon (Staff)"
                        required
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Pilih staff..."
                      >
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.firstName} {emp.lastName}{" "}
                            <span className="text-zinc-400">({emp.department})</span>
                          </SelectItem>
                        ))}
                      </NBSelect>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <NBSelect
                        label="Prioritas"
                        value={field.value}
                        onValueChange={field.onChange}
                        options={[
                          { value: "LOW", label: "Low" },
                          { value: "NORMAL", label: "Normal" },
                          { value: "HIGH", label: "High" },
                        ]}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </NBSection>

            {/* SECTION 2 — Catatan */}
            <NBSection icon={StickyNote} title="Catatan" optional>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <NBTextarea
                      label="Catatan Tambahan"
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Konteks tambahan..."
                      rows={3}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </NBSection>

            {/* SECTION 3 — Item Permintaan */}
            <div className="border border-zinc-200 dark:border-zinc-700">
              <div className="bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  Item Permintaan
                </span>
                {items.length > 0 && (
                  <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 min-w-[20px] text-center">
                    {items.length}
                  </span>
                )}
              </div>

              {/* Add Item Bar */}
              <div className="p-3 bg-zinc-50/50 dark:bg-zinc-800/20 border-b border-zinc-200 dark:border-zinc-700">
                <div className="grid grid-cols-[1fr_80px_auto_auto] gap-3 items-end">
                  <NBSelect
                    label="Produk"
                    value={newItem.productId}
                    onValueChange={(val) => setNewItem({ ...newItem, productId: val })}
                    placeholder="Pilih produk..."
                  >
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="font-mono text-xs text-zinc-400 mr-1">{p.code}</span> {p.name}
                      </SelectItem>
                    ))}
                  </NBSelect>

                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                      Qty
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      className="border font-mono font-bold h-8 text-sm rounded-none text-center transition-colors border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="h-8 flex items-center">
                    <span className="text-xs font-mono font-bold text-zinc-400 min-w-[40px]">
                      {selectedProduct?.unit || "—"}
                    </span>
                  </div>

                  <Button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider h-8 px-4 rounded-none gap-1.5 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tambah
                  </Button>
                </div>
              </div>

              {/* Items List */}
              {items.length > 0 ? (
                <>
                  {/* Table Header */}
                  <div className="grid grid-cols-[32px_1fr_120px_40px] gap-3 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">#</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Produk</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 text-right">Jumlah</span>
                    <span />
                  </div>
                  {items.map((item, index) => {
                    const p = products.find((x) => x.id === item.productId);
                    return (
                      <div
                        key={index}
                        className={`grid grid-cols-[32px_1fr_120px_40px] gap-3 px-3 py-2.5 items-center border-b border-zinc-200 dark:border-zinc-700 last:border-b-0 ${index % 2 === 0 ? "bg-white dark:bg-zinc-900" : "bg-zinc-50/50 dark:bg-zinc-800/30"}`}
                      >
                        <div className="w-6 h-6 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 flex items-center justify-center text-[10px] font-black">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">{p?.name}</div>
                          <div className="text-[11px] font-mono text-zinc-400">{p?.code}</div>
                        </div>
                        <div className="text-right font-mono font-bold text-sm text-zinc-900 dark:text-white">
                          {item.quantity} <span className="text-zinc-400 text-xs">{p?.unit}</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 border border-red-300 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-none"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-center py-10 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                  Belum ada item ditambahkan
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-2.5 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/procurement/requests")}
              className="border border-zinc-300 dark:border-zinc-600 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-5 h-8 rounded-none gap-1.5 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {isSubmitting ? "Mengirim..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
