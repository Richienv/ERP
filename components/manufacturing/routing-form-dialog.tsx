"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Route } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoutingFormData {
  id?: string;
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: RoutingFormData | null;
  onSaved?: () => Promise<void> | void;
}

export function RoutingFormDialog({ open, onOpenChange, initialData, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [submitting, setSubmitting] = useState(false);

  const isEdit = useMemo(() => Boolean(initialData?.id), [initialData]);

  useEffect(() => {
    if (!open) return;
    setCode(initialData?.code || "");
    setName(initialData?.name || "");
    setDescription(initialData?.description || "");
    setIsActive(initialData?.isActive === false ? "false" : "true");
  }, [open, initialData]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nama routing harus diisi", { className: "font-bold border-2 border-black rounded-none" });
      return;
    }

    if (!isEdit && !code.trim()) {
      toast.error("Kode routing harus diisi", { className: "font-bold border-2 border-black rounded-none" });
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isEdit ? `/api/manufacturing/routing/${initialData!.id}` : "/api/manufacturing/routing";
      const method = isEdit ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim() || undefined,
          name: name.trim(),
          description: description.trim() || null,
          isActive: isActive === "true",
        }),
      });

      const payload = await response.json();
      if (!payload.success) {
        toast.error(payload.error || "Gagal menyimpan routing", {
          className: "font-bold border-2 border-black rounded-none"
        });
        return;
      }

      toast.success(isEdit ? "Routing berhasil diperbarui" : "Routing berhasil dibuat", {
        className: "font-bold border-2 border-black rounded-none"
      });
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.mfgRouting.all });
      if (onSaved) await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan jaringan", { className: "font-bold border-2 border-black rounded-none" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl overflow-hidden p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none gap-0 bg-white">
        {/* Header */}
        <div className="bg-black text-white px-6 pt-6 pb-4 shrink-0 border-b-2 border-black">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              <div className="h-10 w-10 bg-white text-black flex items-center justify-center border-2 border-white rounded-none">
                <Route className="h-5 w-5" />
              </div>
              {isEdit ? "Edit Routing" : "Routing Baru"}
            </DialogTitle>
            <p className="text-zinc-400 font-medium text-xs uppercase tracking-wide mt-2">
              Definisikan header proses routing. Detail langkah dikelola di halaman detail.
            </p>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6 space-y-6">

            {/* Identity Card */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="bg-blue-50 border-b-2 border-black p-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-none transform rotate-45" />
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-900">Identitas Routing</span>
              </div>
              <div className="p-4 space-y-4 bg-white">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      Kode Routing {!isEdit && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="RT-XXX-01"
                      disabled={isEdit}
                      className="border-2 border-black font-mono font-bold h-10 rounded-none bg-zinc-50 focus-visible:ring-0 focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      Nama Routing <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: Proses Jahit Utama"
                      className="border-2 border-black font-bold h-10 rounded-none focus-visible:ring-0 focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Deskripsi</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Jelaskan alur proses dan tujuannya..."
                    className="border-2 border-black font-medium min-h-[80px] rounded-none focus-visible:ring-0 focus-visible:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all resize-none"
                  />
                </div>

                <div className="space-y-1.5 max-w-[200px]">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Status</Label>
                  <Select value={isActive} onValueChange={setIsActive}>
                    <SelectTrigger className="border-2 border-black font-bold h-10 rounded-none focus:ring-0 focus:ring-offset-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,0)] focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
                      <SelectItem value="true" className="font-bold cursor-pointer focus:bg-zinc-100 rounded-none">Aktif</SelectItem>
                      <SelectItem value="false" className="font-bold cursor-pointer focus:bg-zinc-100 rounded-none">Nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-black bg-zinc-50 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wide bg-white active:scale-[0.98] rounded-none h-10"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            className="flex-1 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] transition-all font-black uppercase text-xs tracking-wide active:scale-[0.98] rounded-none h-10 hover:bg-zinc-800"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : isEdit ? "Simpan Perubahan" : "Buat Routing"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
