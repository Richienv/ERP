"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Layers } from "lucide-react";
import { NB } from "@/lib/dialog-styles";

interface GroupFormData {
  id?: string;
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: GroupFormData | null;
  onSaved?: () => Promise<void> | void;
}

export function GroupFormDialog({ open, onOpenChange, initialData, onSaved }: Props) {
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
      toast.error("Group name is required");
      return;
    }

    if (!isEdit && !code.trim()) {
      toast.error("Group code is required");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isEdit ? `/api/manufacturing/groups/${initialData!.id}` : "/api/manufacturing/groups";
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
        toast.error(payload.error || "Failed to save group");
        return;
      }

      toast.success(isEdit ? "Group updated" : "Group created");
      onOpenChange(false);
      if (onSaved) await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("Network error while saving group");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={NB.content}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <Layers className="h-5 w-5" />
            {isEdit ? "Edit Work Center Group" : "Create Work Center Group"}
          </DialogTitle>
          <p className={NB.subtitle}>Create only core identity here. Detailed governance via Document & System.</p>
        </DialogHeader>

        <ScrollArea className={NB.scroll}>
          <div className="p-5 space-y-4">
            <div className={NB.section}>
              <div className={`${NB.sectionHead} border-l-4 border-l-blue-400 bg-blue-50`}>
                <span className={NB.sectionTitle}>Identitas Group</span>
              </div>
              <div className={NB.sectionBody}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={NB.label}>Group Code {!isEdit && <span className={NB.labelRequired}>*</span>}</label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="WCG-CUT" disabled={isEdit} className={NB.inputMono} />
                  </div>
                  <div>
                    <label className={NB.label}>Group Name <span className={NB.labelRequired}>*</span></label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cutting Group" className={NB.input} />
                  </div>
                </div>

                <div>
                  <label className={NB.label}>Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe area, flow, and machine responsibility"
                    className={NB.textarea + " min-h-[80px]"}
                  />
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
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : isEdit ? "Save Changes" : "Create Group"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
