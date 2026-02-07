
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

    try {
        await fs.access(DEFAULT_TYPST_BINARY)
        return DEFAULT_TYPST_BINARY
    } catch {
        return "typst"
    }
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
            throw new Error(`Template not found: ${templateName}`)
        }

        const jsonData = JSON.stringify(data)

        // Generate unique ID for this generation request to avoid collision
        const id = crypto.randomUUID()
        const outputPath = path.join(CACHE_DIR, `${id}.pdf`)

        try {
            // Execute Typst
            // Command: ./bin/typst compile --input data='{...}' templates/po/main.typ output.pdf

            const args = [
                "compile",
                "--input", `data=${jsonData}`,
                "--font-path", path.join(TEMPLATE_DIR, "../fonts"), // Assuming shared fonts or standard system fonts
                templatePath,
                outputPath
            ]

            console.log(`[DocumentService] Generating PDF: ${templateName} -> ${outputPath}`)

            const typstBinary = await resolveTypstBinary()

            await new Promise<void>((resolve, reject) => {
                const process = spawn(typstBinary, args)

                let stderr = ""

                process.stderr.on("data", (d) => stderr += d.toString())

                process.on("error", (err: any) => {
                    if (err?.code === "ENOENT") {
                        reject(new Error("Typst binary not found. Install 'typst' or set TYPST_BINARY/TYPST_PATH."))
                        return
                    }
                    reject(err)
                })

                process.on("close", (code) => {
                    if (code === 0) resolve()
                    else reject(new Error(`Typst compilation failed (code ${code}): ${stderr}`))
                })
            })

            // Read output
            const pdfBuffer = await fs.readFile(outputPath)

            // Cleanup (optional: keep for debug? No, delete to save space for now)
            await fs.unlink(outputPath)

            return pdfBuffer

        } catch (error) {
            console.error("[DocumentService] Error:", error)
            throw error
        }
    }
}
