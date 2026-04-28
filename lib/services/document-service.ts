
import { spawn } from "child_process"
import path from "path"
import fs from "fs/promises"
import crypto from "crypto"
import os from "os"

const DEFAULT_TYPST_BINARY = path.join(process.cwd(), "bin", "typst")
const TEMPLATE_DIR = path.join(process.cwd(), "templates")
const CACHE_DIR = path.join(os.tmpdir(), "erp-typst-cache")

async function resolveTypstBinary(): Promise<string> {
    const envBinary = process.env.TYPST_BINARY || process.env.TYPST_PATH
    if (envBinary) return envBinary

    // Check bin/typst (downloaded by install script)
    try {
        await fs.access(DEFAULT_TYPST_BINARY)
        return DEFAULT_TYPST_BINARY
    } catch {
        // Fall through
    }

    // On Vercel, the binary might be in a different location relative to .next
    // Try the standalone server path
    const standaloneBin = path.join(process.cwd(), ".next", "standalone", "bin", "typst")
    try {
        await fs.access(standaloneBin)
        return standaloneBin
    } catch {
        // Fall through
    }

    // Fall back to system PATH (e.g. Homebrew on macOS)
    return "typst"
}

export class DocumentService {

    static async generatePDF(
        templateName: string,
        data: any,
        extraInputs: Record<string, string> = {},
    ): Promise<Buffer> {

        // Ensure cache dir exists
        await fs.mkdir(CACHE_DIR, { recursive: true })

        const templatePath = path.join(TEMPLATE_DIR, templateName, "main.typ")

        // Check template exists
        try {
            await fs.access(templatePath)
        } catch {
            throw new Error(`Template not found: ${templateName} (looked in ${templatePath})`)
        }

        // Normalize Prisma Decimal (and other non-JSON-friendly types) before stringify.
        // Decimal.toJSON returns a string; without this replacer, nested Decimals serialize
        // as "{}" and templates show empty values.
        const jsonData = JSON.stringify(data, (_k, v) => {
            if (v && typeof v === "object" && typeof (v as any).toString === "function" && (v as any).constructor?.name === "Decimal") {
                return (v as any).toString()
            }
            return v
        })

        // Generate unique ID for this generation request to avoid collision
        const id = crypto.randomUUID()
        const outputPath = path.join(CACHE_DIR, `${id}.pdf`)

        try {
            const typstBinary = await resolveTypstBinary()

            // --root needed so templates can #import "../_shared/brand.typ" (Task B2).
            // Build args via composition — avoids splice index coupling that previously
            // corrupted the --root flag when --font-path was inserted at index 2.
            const fontsDir = path.join(TEMPLATE_DIR, "../fonts")
            const fontArgs: string[] = await fs.access(fontsDir).then(
                () => ["--font-path", fontsDir],
                () => [],
            )

            // Each extraInputs key becomes one --input k=v flag (used by the shared
            // brand module to read sys.inputs.company_name etc. — see Task C3).
            const extraInputArgs: string[] = []
            for (const [k, v] of Object.entries(extraInputs)) {
                extraInputArgs.push("--input", `${k}=${v}`)
            }

            const args = [
                "compile",
                "--root", TEMPLATE_DIR,
                ...fontArgs,
                "--input", `data=${jsonData}`,
                ...extraInputArgs,
                templatePath,
                outputPath,
            ]

            console.log(`[DocumentService] Generating PDF: ${templateName} (binary: ${typstBinary})`)

            await new Promise<void>((resolve, reject) => {
                const proc = spawn(typstBinary, args)

                let stderr = ""

                proc.stderr.on("data", (d) => stderr += d.toString())

                proc.on("error", (err: any) => {
                    if (err?.code === "ENOENT") {
                        reject(new Error("Typst binary not found. Install 'typst' or set TYPST_BINARY/TYPST_PATH env var."))
                        return
                    }
                    reject(err)
                })

                proc.on("close", (code) => {
                    if (code === 0) resolve()
                    else reject(new Error(`Typst compilation failed (code ${code}): ${stderr}`))
                })
            })

            // Read output
            const pdfBuffer = await fs.readFile(outputPath)

            // Cleanup
            await fs.unlink(outputPath).catch(() => {})

            return pdfBuffer

        } catch (error) {
            console.error("[DocumentService] Error:", error)
            // Cleanup on failure
            await fs.unlink(outputPath).catch(() => {})
            throw error
        }
    }
}
