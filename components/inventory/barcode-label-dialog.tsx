"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  NBDialog,
  NBDialogHeader,
  NBDialogBody,
  NBDialogFooter,
  NBSection,
} from "@/components/ui/nb-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"
import { Barcode, Eye, Hash, Minus, Plus, Printer } from "lucide-react"
import JsBarcode from "jsbarcode"

interface BarcodeLabelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: {
    name: string
    code: string
    barcode?: string | null
    sellingPrice?: number | string | null
  }
}

export function BarcodeLabelDialog({
  open,
  onOpenChange,
  product,
}: BarcodeLabelDialogProps) {
  const [quantity, setQuantity] = useState(1)
  const previewRef = useRef<SVGSVGElement>(null)
  const printFrameRef = useRef<HTMLIFrameElement | null>(null)

  // Use barcode field if available, otherwise fall back to product code (SKU)
  const barcodeValue = product.barcode || product.code
  const sellingPrice = Number(product.sellingPrice ?? 0)

  // Generate barcode in the preview SVG
  const generateBarcode = useCallback(
    (svgElement: SVGSVGElement) => {
      try {
        JsBarcode(svgElement, barcodeValue, {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 12,
          margin: 4,
          font: "monospace",
        })
      } catch {
        // If CODE128 fails (shouldn't normally), try with a simple text
        JsBarcode(svgElement, barcodeValue, {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 12,
          margin: 4,
          font: "monospace",
          valid: () => true,
        })
      }
    },
    [barcodeValue]
  )

  useEffect(() => {
    if (open && previewRef.current) {
      generateBarcode(previewRef.current)
    }
  }, [open, generateBarcode])

  const handlePrint = () => {
    // Build the label HTML for printing
    const svgContent = previewRef.current?.outerHTML ?? ""
    const labels = Array.from({ length: quantity })
      .map(
        () => `
      <div class="label">
        <div class="product-name">${product.name}</div>
        <div class="barcode-container">${svgContent}</div>
        <div class="info-row">
          <span class="sku">SKU: ${product.code}</span>
          <span class="price">${sellingPrice > 0 ? formatCurrency(sellingPrice) : ""}</span>
        </div>
      </div>`
      )
      .join("")

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Label Barcode - ${product.name}</title>
  <style>
    @page {
      margin: 5mm;
      size: auto;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      display: flex;
      flex-wrap: wrap;
      gap: 4mm;
      padding: 2mm;
    }
    .label {
      width: 50mm;
      padding: 2mm 3mm;
      border: 0.5px solid #ccc;
      page-break-inside: avoid;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1mm;
    }
    .product-name {
      font-size: 9pt;
      font-weight: bold;
      text-align: center;
      line-height: 1.2;
      max-height: 2.4em;
      overflow: hidden;
      width: 100%;
    }
    .barcode-container {
      display: flex;
      justify-content: center;
      width: 100%;
    }
    .barcode-container svg {
      max-width: 44mm;
      height: auto;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      width: 100%;
      font-size: 7pt;
      gap: 2mm;
    }
    .sku {
      color: #555;
      font-family: monospace;
    }
    .price {
      font-weight: bold;
    }
  </style>
</head>
<body>${labels}</body>
</html>`

    // Use an iframe for clean printing (no ERP chrome)
    let iframe = printFrameRef.current
    if (!iframe) {
      iframe = document.createElement("iframe")
      iframe.style.position = "fixed"
      iframe.style.left = "-9999px"
      iframe.style.top = "-9999px"
      iframe.style.width = "0"
      iframe.style.height = "0"
      document.body.appendChild(iframe)
      printFrameRef.current = iframe
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return

    doc.open()
    doc.write(printHtml)
    doc.close()

    // Wait for content to render, then print
    setTimeout(() => {
      iframe?.contentWindow?.print()
    }, 300)
  }

  return (
    <NBDialog open={open} onOpenChange={onOpenChange} size="narrow">
      <NBDialogHeader
        icon={Printer}
        title="Cetak Label Barcode"
        subtitle={product.name}
      />

      <NBDialogBody>
        {/* Preview */}
        <NBSection icon={Eye} title="Pratinjau Label">
          <div className="border-2 border-black p-4 flex flex-col items-center gap-2 bg-white">
            <div className="text-sm font-bold text-center leading-tight">
              {product.name}
            </div>
            <svg ref={previewRef} />
            <div className="flex justify-between w-full text-xs px-2">
              <span className="text-zinc-500 font-mono">
                SKU: {product.code}
              </span>
              {sellingPrice > 0 && (
                <span className="font-bold">
                  {formatCurrency(sellingPrice)}
                </span>
              )}
            </div>
          </div>
        </NBSection>

        {/* Barcode value info */}
        <NBSection icon={Barcode} title="Nilai Barcode">
          <div className="text-sm font-mono font-bold bg-zinc-50 border border-zinc-200 px-3 py-2">
            {barcodeValue}
            {product.barcode ? (
              <span className="text-zinc-400 font-sans font-normal text-xs ml-2">
                (barcode)
              </span>
            ) : (
              <span className="text-zinc-400 font-sans font-normal text-xs ml-2">
                (kode produk)
              </span>
            )}
          </div>
        </NBSection>

        {/* Quantity selector */}
        <NBSection icon={Hash} title="Jumlah Label">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border border-zinc-300 rounded-none h-8 w-8"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              min={1}
              max={500}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val) && val >= 1 && val <= 500) {
                  setQuantity(val)
                }
              }}
              className="border border-zinc-300 rounded-none h-8 w-24 text-center font-mono font-bold text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border border-zinc-300 rounded-none h-8 w-8"
              onClick={() => setQuantity((q) => Math.min(500, q + 1))}
              disabled={quantity >= 500}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <span className="text-xs text-zinc-500">lembar</span>
          </div>
        </NBSection>
      </NBDialogBody>

      <NBDialogFooter
        onCancel={() => onOpenChange(false)}
        onSubmit={handlePrint}
        submitLabel={`Cetak ${quantity} Label`}
      />
    </NBDialog>
  )
}
