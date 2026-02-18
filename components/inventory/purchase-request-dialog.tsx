"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { requestPurchase } from "@/app/actions/inventory";
import { queryKeys } from "@/lib/query-keys";
import { Loader2, ShoppingBag, Box, Tag, CreditCard } from "lucide-react";
import { NB } from "@/lib/dialog-styles";

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
          const callbackData = result.pendingTask ? { pendingTask: result.pendingTask } : { newPO: result.newPO };
          onSuccess(callbackData);
        }
      } else {
        toast.error(result.error || "Failed to request");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-white text-black hover:bg-amber-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-bold uppercase text-xs h-8 gap-2"
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          Request Purchase
        </Button>
      </DialogTrigger>

      <DialogContent className={NB.contentNarrow}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <ShoppingBag className="h-5 w-5" /> Submit Purchase Request
          </DialogTitle>
          <p className={NB.subtitle}>Buat permintaan pembelian ke departemen purchasing.</p>
        </DialogHeader>

        <ScrollArea className={NB.scroll}>
          <div className="p-5 space-y-4">
            {/* Product Info */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
                <Box className="h-4 w-4" />
                <span className={NB.sectionTitle}>Info Produk</span>
              </div>
              <div className={NB.sectionBody}>
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
                      <p className={NB.label + " !mb-0"}>Category</p>
                    </div>
                    <p className="font-bold text-sm">{item.category || "Uncategorized"}</p>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CreditCard className="h-3 w-3 text-zinc-400" />
                      <p className={NB.label + " !mb-0"}>Est. Unit Price</p>
                    </div>
                    <p className="font-bold text-sm">{formatCurrency(item.cost)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Request Form */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
                <span className={NB.sectionTitle}>Detail Permintaan</span>
              </div>
              <div className={NB.sectionBody}>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control as any}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <label className={NB.label}>
                              Quantity ({item.unit}) <span className={NB.labelRequired}>*</span>
                            </label>
                            <FormControl>
                              <Input type="number" {...field} className={NB.inputMono} />
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
                          <label className={NB.label}>Notes for Purchasing</label>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="E.g., Urgent for next week production..."
                              className={NB.textarea + " min-h-[60px]"}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className={NB.footer}>
                      <Button type="button" variant="outline" className={NB.cancelBtn} onClick={() => setOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={loading} className={NB.submitBtn}>
                        {loading ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                        ) : (
                          "Confirm Request"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
