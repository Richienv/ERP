// Copies the pdf.js worker next to the app so the browser can load it from /vendor/pdfjs/.
// Runs on postinstall (local and Vercel). The spare-part invoice reader parses PDFs on the device.
const fs = require("fs")
const path = require("path")

const src = path.join(__dirname, "..", "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs")
const destDir = path.join(__dirname, "..", "public", "vendor", "pdfjs")
try {
    if (!fs.existsSync(src)) {
        console.warn("[copy-pdf-worker] pdfjs-dist not installed; skipping")
        process.exit(0)
    }
    fs.mkdirSync(destDir, { recursive: true })
    fs.copyFileSync(src, path.join(destDir, "pdf.worker.min.mjs"))
    console.log("[copy-pdf-worker] pdf.worker.min.mjs → public/vendor/pdfjs/")
} catch (err) {
    console.warn("[copy-pdf-worker] failed:", err.message)
}
