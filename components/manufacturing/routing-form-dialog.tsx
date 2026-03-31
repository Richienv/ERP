"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import { Route } from "lucide-react";
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
  NBSection,
  NBInput,
  NBTextarea,
  NBSelect,
} from "@/components/ui/nb-dialog";

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
    <NBDialog open={open} onOpenChange={onOpenChange}>
      <NBDialogHeader
        icon={Route}
        title={isEdit ? "Edit Routing" : "Routing Baru"}
        subtitle="Definisikan header proses routing. Detail langkah dikelola di halaman detail."
      />

      <NBDialogBody>
        <NBSection icon={Route} title="Identitas Routing">
          <div className="grid grid-cols-2 gap-3">
            <NBInput
              label="Kode Routing"
              required={!isEdit}
              value={code}
              onChange={setCode}
              placeholder="RT-XXX-01"
              disabled={isEdit}
            />
            <NBInput
              label="Nama Routing"
              required
              value={name}
              onChange={setName}
              placeholder="Contoh: Proses Jahit Utama"
            />
          </div>

          <NBTextarea
            label="Deskripsi"
            value={description}
            onChange={setDescription}
            placeholder="Jelaskan alur proses dan tujuannya..."
            rows={3}
          />

          <NBSelect
            label="Status"
            value={isActive}
            onValueChange={setIsActive}
            options={[
              { value: "true", label: "Aktif" },
              { value: "false", label: "Nonaktif" },
            ]}
            className="max-w-[200px]"
          />
        </NBSection>
      </NBDialogBody>

      <NBDialogFooter
        onCancel={() => onOpenChange(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={isEdit ? "Simpan Perubahan" : "Buat Routing"}
      />
    </NBDialog>
  );
}
