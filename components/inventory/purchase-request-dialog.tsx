"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
  NBSection,
} from "@/components/ui/nb-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { requestPurchase } from "@/app/actions/inventory";
import { queryKeys } from "@/lib/query-keys";
import { ShoppingBag, Box, Tag, CreditCard, FileText } from "lucide-react";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);

const formSchema = z.object({
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  notes: z.string().optional(),
});

interface PurchaseRequestDialogProps {
  item: {
    id: string;
    name: string;
    sku: string;
    category: string;
    unit: string;
    cost: number;
    gap: number;
    reorderPoint: number;
    pendingRestockQty?: number;
    currentStock?: number;
  };
  onSuccess?: (newPO: any) => void;
}

export function PurchaseRequestDialog({ item, onSuccess }: PurchaseRequestDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const defaultQty = item.gap > 0 ? item.gap : item.reorderPoint > 0 ? item.reorderPoint : 10;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      quantity: defaultQty,
      notes: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      const result = await requestPurchase({
        itemId: item.id,
        quantity: values.quantity,
        notes: values.notes,
      });

      if (result.success) {
        toast.success("Purchase Request Sent", {
          description: `Requested ${values.quantity} ${item.unit} for ${item.name}`,
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        setOpen(false);
        form.reset();
        if (onSuccess) {
          const r = result as any;
          const callbackData = r.pendingTask ? { pendingTask: r.pendingTask } : { newPO: r.newPO };
          onSuccess(callbackData);
        }
      } else {
        toast.error((result as any).error || "Failed to request");
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
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-white text-black hover:bg-amber-50 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-bold uppercase text-xs h-8 gap-2 rounded-none"
      >
        <ShoppingBag className="h-3.5 w-3.5" />
        Request Purchase
      </Button>

      <NBDialog open={open} onOpenChange={setOpen} size="narrow">
        <NBDialogHeader
          icon={ShoppingBag}
          title="Submit Purchase Request"
          subtitle="Buat permintaan pembelian ke departemen purchasing."
        />

        <NBDialogBody>
          {/* Product Info */}
          <NBSection icon={Box} title="Info Produk">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 bg-black text-white flex items-center justify-center shrink-0">
                <Box className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-base leading-tight">{item.name}</p>
                <p className="text-xs font-bold text-zinc-400 font-mono">{item.sku}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-50 border border-zinc-200 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Tag className="h-3 w-3 text-zinc-400" />
                  <p className="text-[10px] font-black uppercase text-zinc-500">Category</p>
                </div>
                <p className="font-bold text-sm">{item.category || "Uncategorized"}</p>
              </div>
              <div className="bg-zinc-50 border border-zinc-200 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CreditCard className="h-3 w-3 text-zinc-400" />
                  <p className="text-[10px] font-black uppercase text-zinc-500">Est. Unit Price</p>
                </div>
                <p className="font-bold text-sm">{formatCurrency(item.cost)}</p>
              </div>
            </div>
          </NBSection>

          {/* Recommendation Banner */}
          {(item.pendingRestockQty != null && item.pendingRestockQty > 0) && (
            <div className="border border-amber-400 bg-amber-50 p-3 space-y-1">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-700 flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5" /> Rekomendasi dari Kelola Gudang
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-amber-800">{item.pendingRestockQty}</span>
                <span className="text-sm font-bold text-amber-600">{item.unit}</span>
              </div>
              <p className="text-[10px] text-amber-600">
                Jumlah yang diminta dari permintaan restock kritis. Stok saat ini: <span className="font-black">{item.currentStock ?? 0} {item.unit}</span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px] font-black uppercase border-amber-400 text-amber-700 hover:bg-amber-100 mt-1 rounded-none"
                onClick={() => form.setValue("quantity", item.pendingRestockQty!)}
              >
                Gunakan Rekomendasi
              </Button>
            </div>
          )}

          {/* Request Form */}
          <NBSection icon={FileText} title="Detail Permintaan">
            <Form {...form}>
              <form id="purchase-request-form" onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control as any}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                          Quantity ({item.unit}) <span className="text-red-500">*</span>
                        </label>
                        <FormControl>
                          <Input type="number" {...field} className="border font-mono font-bold h-8 text-sm rounded-none border-zinc-300" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-col justify-end pb-2">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Est. Total</p>
                    <p className="font-black text-sm font-mono">
                      {formatCurrency(form.getValues("quantity") * item.cost)}
                    </p>
                  </div>
                </div>

                <FormField
                  control={form.control as any}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">Notes for Purchasing</label>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="E.g., Urgent for next week production..."
                          className="border border-zinc-300 rounded-none text-sm min-h-[60px] resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </NBSection>
        </NBDialogBody>

        <NBDialogFooter
          onCancel={() => setOpen(false)}
          onSubmit={() => form.handleSubmit(onSubmit as any)()}
          submitting={loading}
          submitLabel="Confirm Request"
        />
      </NBDialog>
    </>
  );
}
