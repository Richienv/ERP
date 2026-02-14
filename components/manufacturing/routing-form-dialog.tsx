"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Route } from "lucide-react";
import { NB } from "@/lib/dialog-styles";

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
      toast.error("Routing name is required");
      return;
    }

    if (!isEdit && !code.trim()) {
      toast.error("Routing code is required");
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
        toast.error(payload.error || "Failed to save routing");
        return;
      }

      toast.success(isEdit ? "Routing updated" : "Routing created");
      onOpenChange(false);
      if (onSaved) await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("Network error while saving routing");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={NB.content}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <Route className="h-5 w-5" />
            {isEdit ? "Edit Routing" : "Create Routing"}
          </DialogTitle>
          <p className={NB.subtitle}>Set process header. Step details managed from Routing detail page.</p>
        </DialogHeader>

        <ScrollArea className={NB.scroll}>
          <div className="p-5 space-y-4">
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                <span className={NB.sectionTitle}>Identitas Routing</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={NB.label}>Routing Code {!isEdit && <span className={NB.labelRequired}>*</span>}</label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="RT-SEW-01" disabled={isEdit} className={NB.inputMono} />
                  </div>
                  <div>
                    <label className={NB.label}>Routing Name <span className={NB.labelRequired}>*</span></label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sewing Core Process" className={NB.input} />
                  </div>
                </div>

                <div>
                  <label className={NB.label}>Description</label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe process flow and intent" className={NB.textarea + " min-h-[80px]"} />
                </div>

                <div className="max-w-[220px]">
                  <label className={NB.label}>Status</label>
                  <Select value={isActive} onValueChange={setIsActive}>
                    <SelectTrigger className={NB.select}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className={NB.footer}>
              <Button variant="outline" className={NB.cancelBtn} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className={NB.submitBtn} disabled={submitting} onClick={handleSubmit}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : isEdit ? "Save Changes" : "Create Routing"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
