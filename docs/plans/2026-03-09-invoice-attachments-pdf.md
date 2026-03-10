# Invoice Attachments + PDF Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add external file attachments (PDF/foto) to invoices AND generate faktur pajak-style invoice PDFs with download button.

**Architecture:** Two parallel workstreams — (1) InvoiceAttachment model + upload/delete API + UI section, (2) Invoice PDF Typst template + generation API + download button. Both reuse existing patterns from BOM attachments and faktur-pajak generation.

**Tech Stack:** Prisma, Supabase Storage, Next.js API routes, Typst templates, TanStack Query, shadcn/ui

---

### Task 1: Prisma Schema — InvoiceAttachment Model

**Files:**
- Modify: `prisma/schema.prisma` (add model after InvoiceItem ~line 1804)

**Step 1: Add InvoiceAttachment model to schema**

```prisma
model InvoiceAttachment {
  id         String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  invoiceId  String   @db.Uuid
  invoice    Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  fileName   String
  fileUrl    String
  fileType   String
  fileSize   Int
  uploadedAt DateTime @default(now())

  @@index([invoiceId])
}
```

Also add `attachments InvoiceAttachment[]` to the Invoice model's relations.

**Step 2: Run migration**

```bash
npx prisma migrate dev --name add_invoice_attachments
```

**Step 3: Regenerate client**

```bash
npx prisma generate
```

---

### Task 2: Invoice Attachment Upload API

**Files:**
- Create: `app/api/finance/invoices/[id]/attachments/route.ts`

**Reference:** `app/api/manufacturing/production-bom/[id]/attachments/route.ts`

**Implementation:**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db"

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        const attachments = await prisma.invoiceAttachment.findMany({
            where: { invoiceId: id },
            orderBy: { uploadedAt: "desc" },
        })
        return NextResponse.json({ success: true, data: attachments })
    } catch (err) {
        console.error("Get invoice attachments error:", err)
        return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

        const { id: invoiceId } = await params

        // Verify invoice exists
        const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
        if (!invoice) {
            return NextResponse.json({ success: false, error: "Invoice tidak ditemukan" }, { status: 404 })
        }

        const formData = await req.formData()
        const file = formData.get("file") as File | null
        if (!file) {
            return NextResponse.json({ success: false, error: "File diperlukan" }, { status: 400 })
        }

        // Validate file type
        const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ success: false, error: "Tipe file tidak didukung. Gunakan PDF, JPG, PNG, atau WebP." }, { status: 400 })
        }

        // Max 10MB
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ success: false, error: "Ukuran file maksimal 10MB" }, { status: 400 })
        }

        const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const storagePath = `invoice-attachments/${invoiceId}/${Date.now()}-${fileName}`

        const arrayBuffer = await file.arrayBuffer()
        const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(storagePath, arrayBuffer, { contentType: file.type })

        if (uploadError) {
            console.error("Upload error:", uploadError)
            return NextResponse.json({ success: false, error: "Gagal mengupload file" }, { status: 500 })
        }

        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath)

        const attachment = await prisma.invoiceAttachment.create({
            data: {
                invoiceId,
                fileName: file.name,
                fileUrl: urlData.publicUrl,
                fileType: file.type,
                fileSize: file.size,
            },
        })

        return NextResponse.json({ success: true, data: attachment })
    } catch (err) {
        console.error("Upload invoice attachment error:", err)
        return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
    }
}
```

---

### Task 3: Invoice Attachment Delete API

**Files:**
- Create: `app/api/finance/invoice-attachments/[id]/route.ts`

**Reference:** `app/api/manufacturing/production-bom-attachments/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/db"

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        const attachment = await prisma.invoiceAttachment.findUnique({ where: { id } })
        if (!attachment) {
            return NextResponse.json({ success: false, error: "Lampiran tidak ditemukan" }, { status: 404 })
        }

        // Delete from Supabase Storage
        try {
            const urlPath = new URL(attachment.fileUrl).pathname
            const storagePath = urlPath.split("/documents/")[1]
            if (storagePath) {
                await supabase.storage.from("documents").remove([storagePath])
            }
        } catch (storageErr) {
            console.error("Storage cleanup error (non-fatal):", storageErr)
        }

        await prisma.invoiceAttachment.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error("Delete invoice attachment error:", err)
        return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 })
    }
}
```

---

### Task 4: TanStack Query Hook for Attachments

**Files:**
- Create: `hooks/use-invoice-attachments.ts`
- Modify: `lib/query-keys.ts` (add attachment keys)

```typescript
// hooks/use-invoice-attachments.ts
"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"

interface InvoiceAttachment {
    id: string
    invoiceId: string
    fileName: string
    fileUrl: string
    fileType: string
    fileSize: number
    uploadedAt: string
}

export function useInvoiceAttachments(invoiceId: string | null) {
    return useQuery({
        queryKey: queryKeys.invoices.attachments(invoiceId ?? ""),
        queryFn: async () => {
            const res = await fetch(`/api/finance/invoices/${invoiceId}/attachments`)
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            return json.data as InvoiceAttachment[]
        },
        enabled: !!invoiceId,
    })
}

export function useUploadInvoiceAttachment(invoiceId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData()
            formData.append("file", file)
            const res = await fetch(`/api/finance/invoices/${invoiceId}/attachments`, {
                method: "POST",
                body: formData,
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            return json.data as InvoiceAttachment
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.attachments(invoiceId) })
            toast.success("Lampiran berhasil diupload")
        },
        onError: (err: Error) => {
            toast.error(err.message || "Gagal mengupload lampiran")
        },
    })
}

export function useDeleteInvoiceAttachment(invoiceId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (attachmentId: string) => {
            const res = await fetch(`/api/finance/invoice-attachments/${attachmentId}`, {
                method: "DELETE",
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.invoices.attachments(invoiceId) })
            toast.success("Lampiran berhasil dihapus")
        },
        onError: (err: Error) => {
            toast.error(err.message || "Gagal menghapus lampiran")
        },
    })
}
```

Add to `lib/query-keys.ts`:
```typescript
invoices: {
    all: ["invoices"] as const,
    kanban: (params?: { q?: string; type?: string }) =>
        [...queryKeys.invoices.all, "kanban", params ?? {}] as const,
    attachments: (invoiceId: string) =>
        [...queryKeys.invoices.all, "attachments", invoiceId] as const,
},
```

---

### Task 5: Invoice Attachment UI Component

**Files:**
- Create: `components/finance/invoice-attachments.tsx`

Component renders:
- Upload dropzone (drag & drop or click)
- File list with preview (images inline, PDF icon for PDFs)
- Delete button per attachment
- Loading states
- File size display (formatted)

Uses `useInvoiceAttachments`, `useUploadInvoiceAttachment`, `useDeleteInvoiceAttachment` hooks.

---

### Task 6: Invoice PDF Typst Template

**Files:**
- Create: `templates/invoice/main.typ`

**Reference:** `templates/faktur_pajak/main.typ`

Template should include:
- Company header with logo area
- Invoice number, issue date, due date
- Seller info: company name, NPWP, address
- Buyer info: customer/supplier name, NPWP, address
- Items table: No., Description, Qty, Unit Price, Total
- Summary: Subtotal (DPP), PPN 11%, Discount, Grand Total
- Payment terms and bank info section
- Signature block (two columns)
- Indonesian format throughout

---

### Task 7: Invoice PDF Generation API

**Files:**
- Create: `app/api/documents/invoice/[id]/route.ts`

**Reference:** `app/api/documents/faktur-pajak/[id]/route.ts`

Same pattern: fetch invoice with items + customer/supplier + addresses, transform to template data, call `DocumentService.generatePDF("invoice", templateData)`, return PDF buffer.

---

### Task 8: Wire Attachments + PDF Button into Invoice Page

**Files:**
- Modify: `app/finance/invoices/page.tsx` (add attachment section and PDF download button to invoice detail sheet/dialog)

Add to the invoice detail view:
1. "Cetak Invoice" button → opens `/api/documents/invoice/{id}?disposition=inline` in new tab
2. "Lampiran" section → renders `<InvoiceAttachmentSection invoiceId={id} />`

---
