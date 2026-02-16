
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
        data: any
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

        const jsonData = JSON.stringify(data)

        // Generate unique ID for this generation request to avoid collision
        const id = crypto.randomUUID()
        const outputPath = path.join(CACHE_DIR, `${id}.pdf`)

        try {
            const typstBinary = await resolveTypstBinary()

            const args = [
                "compile",
                "--input", `data=${jsonData}`,
                templatePath,
                outputPath
            ]

            // Only add --font-path if the fonts directory exists
            const fontsDir = path.join(TEMPLATE_DIR, "../fonts")
            try {
                await fs.access(fontsDir)
                args.splice(2, 0, "--font-path", fontsDir)
            } catch {
                // No fonts dir, skip — Typst will use system/bundled fonts
            }

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
