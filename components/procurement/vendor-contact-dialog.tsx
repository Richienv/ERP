"use client";

import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
} from "@/components/ui/nb-dialog";
import { Button } from "@/components/ui/button";
import { Mail, Phone, ExternalLink, UserCircle } from "lucide-react";
import { NB } from "@/lib/dialog-styles";
import { useState } from "react";

interface VendorContactDialogProps {
  vendorName: string;
  email: string | null;
  phone: string | null;
  trigger?: React.ReactNode;
}

export function VendorContactDialog({ vendorName, email, phone, trigger }: VendorContactDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger || (
          <Button variant="outline" className={NB.cancelBtn}>
            Contact
          </Button>
        )}
      </span>

      <NBDialog open={open} onOpenChange={setOpen} size="narrow">
        <NBDialogHeader icon={UserCircle} title="Hubungi Vendor" subtitle={vendorName} />

        <NBDialogBody>
          <Button
            variant="outline"
            size="lg"
            className="w-full h-16 justify-between border-2 border-black font-bold"
            onClick={() => phone && window.open(`https://wa.me/${phone.replace(/\D/g, "")}`, "_blank")}
            disabled={!phone}
          >
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 border-2 border-green-300">
                <Phone className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-left">
                <div className="font-black text-xs uppercase">WhatsApp</div>
                <div className="text-xs text-zinc-500 font-mono">{phone || "Nomor tidak tersedia"}</div>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-zinc-400" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full h-16 justify-between border-2 border-black font-bold"
            onClick={() => email && window.location.assign(`mailto:${email}`)}
            disabled={!email}
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 border-2 border-blue-300">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div className="text-left">
                <div className="font-black text-xs uppercase">Email</div>
                <div className="text-xs text-zinc-500">{email || "Email tidak tersedia"}</div>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-zinc-400" />
          </Button>
        </NBDialogBody>
      </NBDialog>
    </>
  );
}
