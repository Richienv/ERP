"use client";

import { useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { receiveGoodsFromPO } from "@/app/actions/inventory";
import { PackagePlus, Box, CheckCircle2, Truck, Warehouse } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useWarehouses } from "@/hooks/use-warehouses";

const formSchema = z.object({
  poId: z.string().min(1, "Purchase Order is required"),
  warehouseId: z.string().min(1, "Gudang tujuan harus dipilih"),
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
  const queryClient = useQueryClient();
  const { data: allWarehouses } = useWarehouses();

  const defaultWarehouse = item.warehouses[0]?.id || "";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      poId: openPOs.length === 1 ? openPOs[0].id : "",
      warehouseId: defaultWarehouse,
      receivedQty: openPOs.length === 1 ? openPOs[0].remainingQty : 0,
    },
  });

  useEffect(() => {
    if (open && openPOs.length > 0) {
      const defaultPO = openPOs[0];
      setSelectedPO(defaultPO);
      form.setValue("poId", defaultPO.id);
      form.setValue("warehouseId", defaultWarehouse);
      form.setValue("receivedQty", defaultPO.remainingQty);
    }
  }, [open, openPOs, form, defaultWarehouse]);

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
        warehouseId: values.warehouseId,
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
      } else {
        toast.error((result as any).error || "Gagal menerima barang");
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
        className="bg-emerald-600 text-white hover:bg-emerald-700 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-bold uppercase text-xs h-8 gap-2 rounded-none"
      >
        <PackagePlus className="h-3.5 w-3.5" />
        Receive Goods
      </Button>

      <NBDialog open={open} onOpenChange={setOpen}>
        <NBDialogHeader
          icon={Truck}
          title="Confirm Goods Receipt"
          subtitle="Verifikasi penerimaan barang dari Purchase Order."
        />

        <NBDialogBody>
          {/* Item Info */}
          <NBSection icon={Box} title="Detail Item">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 bg-black text-white flex items-center justify-center shrink-0">
                <Box className="h-6 w-6" />
              </div>
              <div>
                <p className="font-black text-base leading-tight">{item.name}</p>
                <p className="text-xs font-bold text-zinc-400">Unit: {item.unit}</p>
              </div>
            </div>
          </NBSection>

          {/* PO Selection & Quantity */}
          <NBSection icon={PackagePlus} title="Penerimaan">
            <Form {...form}>
              <form id="goods-receipt-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control as any}
                  name="poId"
                  render={({ field }) => (
                    <FormItem>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                        Source PO <span className="text-red-500">*</span>
                      </label>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val);
                          handlePOSelect(val);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-8 text-sm rounded-none border border-zinc-300">
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
                  <div className="bg-blue-50 border border-blue-200 p-3">
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
                  name="warehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                        <Warehouse className="inline h-3.5 w-3.5 mr-1" />
                        Gudang Tujuan <span className="text-red-500">*</span>
                      </label>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-8 text-sm rounded-none border border-zinc-300">
                            <SelectValue placeholder="Pilih gudang..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(allWarehouses ?? item.warehouses).map((wh: any) => (
                            <SelectItem key={wh.id} value={wh.id}>
                              {wh.code ? `${wh.code} — ${wh.name}` : wh.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control as any}
                  name="receivedQty"
                  render={({ field }) => (
                    <FormItem>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                        Received Quantity <span className="text-red-500">*</span>
                      </label>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="border border-black rounded-none font-mono font-black text-2xl h-14 text-center"
                        />
                      </FormControl>
                      <p className="text-[10px] text-zinc-400 font-bold mt-1 text-center">
                        in {item.unit}
                      </p>
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
          onSubmit={() => form.handleSubmit(onSubmit)()}
          submitting={loading}
          submitLabel="Confirm Receipt"
        />
      </NBDialog>
    </>
  );
}
