import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { isLocalDemoAllowed } from "@/lib/local-demo"

/**
 * Where captured supplier invoices are kept.
 *
 * Production: Supabase Storage, bucket `documents`, path `supplier-invoices/<sha256>.<ext>`, served
 * only through an authenticated route with a short-lived signed URL (never a public URL).
 * Local demo: `.local-uploads/` in the project (git-ignored), so the flow works without Supabase.
 *
 * Content-addressed: the same file uploaded twice lands on the same path.
 */

export const INVOICE_FILE_TYPES: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
export const INVOICE_FILE_MAX_BYTES = 10 * 1024 * 1024
const BUCKET = "documents"
const LOCAL_ROOT = path.join(process.cwd(), ".local-uploads")

type StorageClient = {
    storage: {
        from: (bucket: string) => {
            upload: (path: string, body: ArrayBuffer | Uint8Array, opts: { contentType: string; upsert: boolean }) => Promise<{ error: { message: string } | null }>
            createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>
        }
    }
}

export function isLocalFileStore(): boolean {
    return process.env.SPAREPART_FILE_STORE === "local" || isLocalDemoAllowed()
}

export function sha256Hex(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex")
}

export function storagePathFor(sha256: string, contentType: string): string {
    const ext = INVOICE_FILE_TYPES[contentType] || "bin"
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Hash file tidak valid")
    return `supplier-invoices/${sha256}.${ext}`
}

function localPath(storagePath: string): string {
    const full = path.normalize(path.join(LOCAL_ROOT, storagePath))
    if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Path file tidak valid")
    return full
}

export async function saveInvoiceFile(bytes: Uint8Array, contentType: string, supabase: StorageClient | null) {
    const sha256 = sha256Hex(bytes)
    const storagePath = storagePathFor(sha256, contentType)
    if (isLocalFileStore() || !supabase) {
        const full = localPath(storagePath)
        await mkdir(path.dirname(full), { recursive: true })
        await writeFile(full, bytes)
    } else {
        const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, { contentType, upsert: true })
        if (error) throw new Error(`Gagal menyimpan file: ${error.message}`)
    }
    return { sha256, storagePath }
}

export async function readLocalInvoiceFile(storagePath: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(localPath(storagePath)))
}

export async function signedInvoiceFileUrl(storagePath: string, supabase: StorageClient): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60)
    if (error || !data) throw new Error(error?.message || "File tidak ditemukan")
    return data.signedUrl
}
