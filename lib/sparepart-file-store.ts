import { createHash } from "node:crypto"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
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
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
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

/** Disk storage is for local development only — never on a production server. */
export function isLocalFileStore(): boolean {
    if (process.env.NODE_ENV === "production") return false
    return process.env.SPAREPART_FILE_STORE === "local" || isLocalDemoAllowed()
}

/** Content type for a stored file, from its own extension (never from what a client said). */
export function contentTypeForPath(storagePath: string): string {
    const ext = storagePath.split(".").pop() || ""
    const hit = Object.entries(INVOICE_FILE_TYPES).find(([, e]) => e === ext)
    return hit ? hit[0] : "application/octet-stream"
}

/** True when the bytes really are the declared type (PDF / JPEG / PNG / WebP). */
export function hasMagicBytes(bytes: Uint8Array, contentType: string): boolean {
    const b = bytes
    switch (contentType) {
        case "application/pdf":
            return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 // %PDF
        case "image/jpeg":
            return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
        case "image/png":
            return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
        case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 // PK.. (zip)
        case "image/webp":
            return b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
        default:
            return false
    }
}

/** Local store: the file must really be there. Supabase: the path is derived from the hash, so trust it. */
export async function invoiceFileExists(storagePath: string): Promise<boolean> {
    if (!isLocalFileStore()) return true
    try {
        await access(localPath(storagePath))
        return true
    } catch {
        return false
    }
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
