"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import { Layers } from "lucide-react";
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
      queryClient.invalidateQueries({ queryKey: queryKeys.mfgGroups.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.mfgDashboard.all });
      if (onSaved) await onSaved();
    } catch (error) {
      console.error(error);
      toast.error("Network error while saving group");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <NBDialog open={open} onOpenChange={onOpenChange}>
      <NBDialogHeader
        icon={Layers}
        title={isEdit ? "Edit Work Center Group" : "Create Work Center Group"}
        subtitle="Create only core identity here. Detailed governance via Document & System."
      />

      <NBDialogBody>
        <NBSection icon={Layers} title="Identitas Group">
          <div className="grid grid-cols-2 gap-3">
            <NBInput
              label="Group Code"
              required={!isEdit}
              value={code}
              onChange={setCode}
              placeholder="WCG-CUT"
              disabled={isEdit}
            />
            <NBInput
              label="Group Name"
              required
              value={name}
              onChange={setName}
              placeholder="Cutting Group"
            />
          </div>

          <NBTextarea
            label="Description"
            value={description}
            onChange={setDescription}
            placeholder="Describe area, flow, and machine responsibility"
            rows={3}
          />

          <NBSelect
            label="Status"
            value={isActive}
            onValueChange={setIsActive}
            options={[
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ]}
            className="max-w-[220px]"
          />
        </NBSection>
      </NBDialogBody>

      <NBDialogFooter
        onCancel={() => onOpenChange(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={isEdit ? "Save Changes" : "Create Group"}
      />
    </NBDialog>
  );
}
