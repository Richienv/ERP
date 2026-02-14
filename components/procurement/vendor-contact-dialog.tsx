"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Phone, ExternalLink, UserCircle } from "lucide-react";
import { NB } from "@/lib/dialog-styles";

interface VendorContactDialogProps {
  vendorName: string;
  email: string | null;
  phone: string | null;
  trigger?: React.ReactNode;
}

export function VendorContactDialog({ vendorName, email, phone, trigger }: VendorContactDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className={NB.cancelBtn}>
            Contact
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className={NB.contentNarrow}>
        <DialogHeader className={NB.header}>
          <DialogTitle className={NB.title}>
            <UserCircle className="h-5 w-5" /> Hubungi Vendor
          </DialogTitle>
          <p className={NB.subtitle}>{vendorName}</p>
        </DialogHeader>

        <div className="p-5 space-y-3">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
