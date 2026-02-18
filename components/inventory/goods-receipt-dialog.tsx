"use client";

import { useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { receiveGoodsFromPO } from "@/app/actions/inventory";
import { Loader2, PackagePlus, Box, CheckCircle2, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { NB } from "@/lib/dialog-styles";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

const formSchema = z.object({
  poId: z.string().min(1, "Purchase Order is required"),
  receivedQty: z.coerce.number().min(1, "Quantity must be at least 1"),
});

interface OpenPO {
  id: string;
  number: string;
  supplierName: string;
  expectedDate: Date | null;
  orderedQty: number;
  receivedQty: number;
  remainingQty: number;
}

interface GoodsReceiptDialogProps {
  item: {
    id: string;
    name: string;
    unit: string;
    warehouses: { id: string; name: string; qty: number }[];
  };
  openPOs: OpenPO[];
  defaultWarehouseId?: string;
  onSuccess?: () => void;
}

export function GoodsReceiptDialog({ item, openPOs, onSuccess }: GoodsReceiptDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPO, setSelectedPO] = useState<OpenPO | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      poId: openPOs.length === 1 ? openPOs[0].id : "",
      receivedQty: openPOs.length === 1 ? openPOs[0].remainingQty : 0,
    },
  });

  useEffect(() => {
    if (open && openPOs.length > 0) {
      const defaultPO = openPOs[0];
      setSelectedPO(defaultPO);
      form.setValue("poId", defaultPO.id);
      form.setValue("receivedQty", defaultPO.remainingQty);
    }
  }, [open, openPOs, form]);

  const handlePOSelect = (poId: string) => {
    const po = openPOs.find((p) => p.id === poId);
    if (po) {
      setSelectedPO(po);
      form.setValue("receivedQty", po.remainingQty);
    }
  };

  const onSubmit: SubmitHandler<z.infer<typeof formSchema>> = async (values) => {
    if (!selectedPO) return;

    setLoading(true);
    try {
      const result = await receiveGoodsFromPO({
        itemId: item.id,
        poId: values.poId,
        warehouseId: item.warehouses[0]?.id || "",
        receivedQty: values.receivedQty,
      });

      if (result.success) {
        toast.success("Stock Received Successfully!", {
          description: `Added ${values.receivedQty} ${item.unit} to inventory.`,
          icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
        });
        queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.inventoryDashboard.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.procurementDashboard.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.stockMovements.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.stockTransfers.all });
        setOpen(false);
        form.reset();
        setSelectedPO(null);
        if (onSuccess) onSuccess();
        if (onSuccess) onSuccess();
      } else {
        toast.error(result.error);
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
          className="bg-emerald-600 text-white hover:bg-emerald-700 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-bold uppercase text-xs h-8 gap-2"
        >
          <PackagePlus className="h-3.5 w-3.5" />
          Receive Goods
        </Button>
      </DialogTrigger>

      <DialogContent className={NB.content}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <Truck className="h-5 w-5" /> Confirm Goods Receipt
          </DialogTitle>
          <p className={NB.subtitle}>Verifikasi penerimaan barang dari Purchase Order.</p>
        </DialogHeader>

        <ScrollArea className={NB.scroll}>
          <div className="p-5 space-y-4">
            {/* Item Info */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
                <Box className="h-4 w-4" />
                <span className={NB.sectionTitle}>Detail Item</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 bg-black text-white flex items-center justify-center shrink-0">
                    <Box className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-black text-base leading-tight">{item.name}</p>
                    <p className="text-xs font-bold text-zinc-400">Unit: {item.unit}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* PO Selection & Quantity */}
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-emerald-400 bg-emerald-50`}>
                <PackagePlus className="h-4 w-4" />
                <span className={NB.sectionTitle}>Penerimaan</span>
              </div>
              <div className={NB.sectionBody}>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control as any}
                      name="poId"
                      render={({ field }) => (
                        <FormItem>
                          <label className={NB.label}>
                            Source PO <span className={NB.labelRequired}>*</span>
                          </label>
                          <Select
                            onValueChange={(val) => {
                              field.onChange(val);
                              handlePOSelect(val);
                            }}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className={NB.select}>
                                <SelectValue placeholder="Select Purchase Order..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {openPOs.map((po) => (
                                <SelectItem key={po.id} value={po.id}>
                                  {po.number} — {po.supplierName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Selected PO Summary */}
                    {selectedPO && (
                      <div className="bg-blue-50 border-2 border-blue-200 p-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase text-blue-500">Supplier</p>
                            <p className="font-bold text-sm truncate">{selectedPO.supplierName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-blue-500">Ordered</p>
                            <p className="font-bold text-sm font-mono">
                              {selectedPO.orderedQty} {item.unit}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-blue-500">Remaining</p>
                            <p className="font-black text-sm font-mono text-blue-700">
                              {selectedPO.remainingQty} {item.unit}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <FormField
                      control={form.control as any}
                      name="receivedQty"
                      render={({ field }) => (
                        <FormItem>
                          <label className={NB.label}>
                            Received Quantity <span className={NB.labelRequired}>*</span>
                          </label>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              className="border-2 border-black font-mono font-black text-2xl h-14 text-center"
                            />
                          </FormControl>
                          <p className="text-[10px] text-zinc-400 font-bold mt-1 text-center">
                            in {item.unit}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className={NB.footer}>
                      <Button
                        type="button"
                        variant="outline"
                        className={NB.cancelBtn}
                        onClick={() => setOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={loading} className={NB.submitBtn}>
                        {loading ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                        ) : (
                          "Confirm Receipt"
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
