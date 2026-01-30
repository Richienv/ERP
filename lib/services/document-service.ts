
import { spawn } from "child_process"
import path from "path"
import fs from "fs/promises"
import crypto from "crypto"

const TYPST_BINARY = path.join(process.cwd(), "bin", "typst")
const TEMPLATE_DIR = path.join(process.cwd(), "templates")
const CACHE_DIR = path.join(process.cwd(), "tmp", "typst-cache")

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

            await new Promise<void>((resolve, reject) => {
                const process = spawn(TYPST_BINARY, args)

                let stderr = ""

                process.stderr.on("data", (d) => stderr += d.toString())

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
