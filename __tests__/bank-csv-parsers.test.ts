import { describe, it, expect } from "vitest"
import {
  parseBCACSV,
  parseGenericBankCSV,
  parseIndonesianNumber,
  parseDateDDMMYYYY,
  detectDelimiter,
  splitCSVLine,
} from "@/lib/bank-csv-parsers"

// ──────────────────────────────────────────────
// Helper: Indonesian number parsing
// ──────────────────────────────────────────────

describe("parseIndonesianNumber", () => {
  it("parses standard Indonesian format: 1.500.000,00", () => {
    expect(parseIndonesianNumber("1.500.000,00")).toBe(1500000)
  })

  it("parses without decimals: 1.500.000", () => {
    expect(parseIndonesianNumber("1.500.000")).toBe(1500000)
  })

  it("parses small number: 500,00", () => {
    expect(parseIndonesianNumber("500,00")).toBe(500)
  })

  it("parses plain integer: 1500000", () => {
    expect(parseIndonesianNumber("1500000")).toBe(1500000)
  })

  it("parses international format: 1,500,000.00", () => {
    expect(parseIndonesianNumber("1,500,000.00")).toBe(1500000)
  })

  it("returns absolute value for negative numbers", () => {
    expect(parseIndonesianNumber("-1.500.000,00")).toBe(1500000)
  })

  it("returns 0 for empty/invalid", () => {
    expect(parseIndonesianNumber("")).toBe(0)
    expect(parseIndonesianNumber("-")).toBe(0)
    expect(parseIndonesianNumber("abc")).toBe(0)
  })

  it("strips surrounding quotes", () => {
    expect(parseIndonesianNumber('"1.500.000,00"')).toBe(1500000)
    expect(parseIndonesianNumber("'500,00'")).toBe(500)
  })

  it("handles decimal precision", () => {
    expect(parseIndonesianNumber("1.234.567,89")).toBe(1234567.89)
  })
})

// ──────────────────────────────────────────────
// Helper: Date parsing
// ──────────────────────────────────────────────

describe("parseDateDDMMYYYY", () => {
  it("parses DD/MM/YYYY", () => {
    expect(parseDateDDMMYYYY("15/03/2026")).toBe("2026-03-15")
  })

  it("parses D/M/YYYY (no leading zeros)", () => {
    expect(parseDateDDMMYYYY("5/3/2026")).toBe("2026-03-05")
  })

  it("parses DD-MM-YYYY", () => {
    expect(parseDateDDMMYYYY("15-03-2026")).toBe("2026-03-15")
  })

  it("passes through YYYY-MM-DD", () => {
    expect(parseDateDDMMYYYY("2026-03-15")).toBe("2026-03-15")
  })

  it("returns null for invalid dates", () => {
    expect(parseDateDDMMYYYY("")).toBeNull()
    expect(parseDateDDMMYYYY("not a date")).toBeNull()
    expect(parseDateDDMMYYYY("32/13/2026")).toBeNull()
  })

  it("strips surrounding quotes", () => {
    expect(parseDateDDMMYYYY('"15/03/2026"')).toBe("2026-03-15")
  })
})

// ──────────────────────────────────────────────
// Helper: CSV splitting
// ──────────────────────────────────────────────

describe("splitCSVLine", () => {
  it("splits comma-separated values", () => {
    expect(splitCSVLine("a,b,c", ",")).toEqual(["a", "b", "c"])
  })

  it("handles quoted fields with commas", () => {
    expect(splitCSVLine('"hello, world",b,c', ",")).toEqual(["hello, world", "b", "c"])
  })

  it("handles escaped quotes", () => {
    expect(splitCSVLine('"PT ""Jaya""",b', ",")).toEqual(['PT "Jaya"', "b"])
  })

  it("splits semicolon-separated values", () => {
    expect(splitCSVLine("a;b;c", ";")).toEqual(["a", "b", "c"])
  })

  it("trims whitespace around fields", () => {
    expect(splitCSVLine("  a , b , c  ", ",")).toEqual(["a", "b", "c"])
  })
})

describe("detectDelimiter", () => {
  it("detects comma as delimiter", () => {
    expect(detectDelimiter([
      "Tanggal,Keterangan,Jumlah,Saldo",
      "15/03/2026,TRF MASUK,1.500.000,5.000.000",
    ])).toBe(",")
  })

  it("detects semicolon as delimiter", () => {
    expect(detectDelimiter([
      "Tanggal;Keterangan;Jumlah;Saldo",
      "15/03/2026;TRF MASUK;1.500.000;5.000.000",
    ])).toBe(";")
  })
})

// ──────────────────────────────────────────────
// BCA CSV Parser — Variant A (amount + DB/CR type)
// ──────────────────────────────────────────────

describe("parseBCACSV - Variant A (amount + type column)", () => {
  const csvVariantA = [
    "Tanggal,Keterangan,Cabang,Jumlah,Saldo,DB/CR",
    "15/03/2026,TRSF E-BANKING DB 0123456789 PT ABC INV-2026-001,0391,5.000.000,10.000.000,DB",
    "16/03/2026,SWITCHING CR DARI/BNI 9876543 PAY-2026-001,0391,3.500.000,13.500.000,CR",
  ].join("\n")

  it("parses both DB and CR rows", () => {
    const result = parseBCACSV(csvVariantA)
    expect(result.success).toBe(true)
    expect(result.lines).toHaveLength(2)
  })

  it("correctly identifies debit (money out)", () => {
    const result = parseBCACSV(csvVariantA)
    expect(result.lines[0].debit).toBe(5000000)
    expect(result.lines[0].credit).toBe(0)
  })

  it("correctly identifies credit (money in)", () => {
    const result = parseBCACSV(csvVariantA)
    expect(result.lines[1].debit).toBe(0)
    expect(result.lines[1].credit).toBe(3500000)
  })

  it("parses dates to YYYY-MM-DD", () => {
    const result = parseBCACSV(csvVariantA)
    expect(result.lines[0].date).toBe("2026-03-15")
    expect(result.lines[1].date).toBe("2026-03-16")
  })

  it("extracts references from description", () => {
    const result = parseBCACSV(csvVariantA)
    expect(result.lines[0].reference).toBe("INV-2026-001")
    expect(result.lines[1].reference).toBe("PAY-2026-001")
  })

  it("sets bankName to BCA", () => {
    const result = parseBCACSV(csvVariantA)
    expect(result.bankName).toBe("BCA")
  })
})

// ──────────────────────────────────────────────
// BCA CSV Parser — Variant B (separate debit/credit columns)
// ──────────────────────────────────────────────

describe("parseBCACSV - Variant B (separate debit/credit columns)", () => {
  const csvVariantB = [
    "Tanggal;Keterangan;Debit;Credit;Saldo",
    "15/03/2026;TRSF E-BANKING DB PT ABC;5.000.000,00;;10.000.000,00",
    "16/03/2026;SWITCHING CR DARI BNI;;3.500.000,00;13.500.000,00",
  ].join("\n")

  it("parses semicolon-delimited with separate debit/credit", () => {
    const result = parseBCACSV(csvVariantB)
    expect(result.success).toBe(true)
    expect(result.lines).toHaveLength(2)
  })

  it("parses debit column correctly", () => {
    const result = parseBCACSV(csvVariantB)
    expect(result.lines[0].debit).toBe(5000000)
    expect(result.lines[0].credit).toBe(0)
  })

  it("parses credit column correctly", () => {
    const result = parseBCACSV(csvVariantB)
    expect(result.lines[1].debit).toBe(0)
    expect(result.lines[1].credit).toBe(3500000)
  })
})

// ──────────────────────────────────────────────
// BCA CSV Parser — Variant C (signed amount, no header)
// ──────────────────────────────────────────────

describe("parseBCACSV - Variant C (signed amount, no header)", () => {
  const csvVariantC = [
    "15/03/2026,Pembayaran vendor,-5.000.000,10.000.000",
    "16/03/2026,Terima dari customer,3.500.000,13.500.000",
  ].join("\n")

  it("parses negative amount as debit", () => {
    const result = parseBCACSV(csvVariantC)
    expect(result.success).toBe(true)
    expect(result.lines[0].debit).toBe(5000000)
    expect(result.lines[0].credit).toBe(0)
  })

  it("parses positive amount as credit", () => {
    const result = parseBCACSV(csvVariantC)
    expect(result.lines[1].debit).toBe(0)
    expect(result.lines[1].credit).toBe(3500000)
  })
})

// ──────────────────────────────────────────────
// BCA CSV Parser — Preamble skipping
// ──────────────────────────────────────────────

describe("parseBCACSV - preamble handling", () => {
  const csvWithPreamble = [
    "Rekening: 1234567890",
    "Periode: 01/03/2026 - 31/03/2026",
    "PT TEKSTIL JAYA",
    "",
    "Tanggal,Keterangan,Cabang,Jumlah,Saldo,DB/CR",
    "15/03/2026,TRF MASUK,0391,5.000.000,10.000.000,CR",
  ].join("\n")

  it("skips preamble lines and parses data", () => {
    const result = parseBCACSV(csvWithPreamble)
    expect(result.success).toBe(true)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].credit).toBe(5000000)
  })
})

// ──────────────────────────────────────────────
// BCA CSV Parser — Summary row skipping
// ──────────────────────────────────────────────

describe("parseBCACSV - summary row skipping", () => {
  const csvWithSummary = [
    "Tanggal,Keterangan,Cabang,Jumlah,Saldo,DB/CR",
    "Saldo Awal,,,,,0",
    "15/03/2026,TRF MASUK,0391,5.000.000,5.000.000,CR",
    "Saldo Akhir,,,,,5.000.000",
  ].join("\n")

  it("skips saldo awal and saldo akhir rows", () => {
    const result = parseBCACSV(csvWithSummary)
    expect(result.success).toBe(true)
    expect(result.lines).toHaveLength(1)
    expect(result.skippedRows).toBeGreaterThanOrEqual(2)
  })
})

// ──────────────────────────────────────────────
// BCA CSV Parser — Edge cases
// ──────────────────────────────────────────────

describe("parseBCACSV - edge cases", () => {
  it("returns error for empty input", () => {
    const result = parseBCACSV("")
    expect(result.success).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it("returns error for whitespace-only input", () => {
    const result = parseBCACSV("   \n  \n  ")
    expect(result.success).toBe(false)
  })

  it("handles Windows line endings", () => {
    const csv = "Tanggal,Keterangan,Cabang,Jumlah,Saldo,DB/CR\r\n15/03/2026,TRF MASUK,0391,5.000.000,5.000.000,CR\r\n"
    const result = parseBCACSV(csv)
    expect(result.success).toBe(true)
    expect(result.lines).toHaveLength(1)
  })

  it("skips zero-amount rows", () => {
    const csv = [
      "Tanggal,Keterangan,Cabang,Jumlah,Saldo,DB/CR",
      "15/03/2026,Biaya Admin,0391,0,5.000.000,DB",
      "16/03/2026,TRF MASUK,0391,1.000.000,6.000.000,CR",
    ].join("\n")
    const result = parseBCACSV(csv)
    expect(result.lines).toHaveLength(1)
    expect(result.skippedRows).toBeGreaterThanOrEqual(1)
  })
})

// ──────────────────────────────────────────────
// Real-world BCA e-Statement format
// ──────────────────────────────────────────────

describe("parseBCACSV - real-world BCA e-Statement", () => {
  const realWorldCSV = [
    "Rekening: 0391234567",
    "Periode: 01/03/2026 s/d 31/03/2026",
    "",
    "Tanggal,Keterangan,Cabang,Jumlah,Saldo,Mutasi",
    "01/03/2026,TRSF E-BANKING CR 0987654321 PAYMENT INV-2026-0001,0391,25.750.000,125.750.000,CR",
    "03/03/2026,TRSF E-BANKING DB 1122334455 BAYAR SUPPLIER PO-2026-003,0391,15.000.000,110.750.000,DB",
    "05/03/2026,BYR VIA EDC BCA DEBIT CARD,0391,2.500.000,108.250.000,DB",
    "10/03/2026,BUNGA JASA GIRO,0391,125.000,108.375.000,CR",
    "15/03/2026,SWITCHING CR 009 DARI BNI/REF:TRF20260315001 PT GARMEN INDO,0391,50.000.000,158.375.000,CR",
    "20/03/2026,TRSF E-BANKING DB 5544332211 VPAY-2026-005,0391,8.750.000,149.625.000,DB",
    "25/03/2026,PAJAK ABP PPH 23,0391,1.250.000,148.375.000,DB",
    "31/03/2026,BIAYA ADM,0391,0,148.375.000,DB",
  ].join("\n")

  it("parses all valid transaction rows", () => {
    const result = parseBCACSV(realWorldCSV)
    expect(result.success).toBe(true)
    // 8 rows - 1 zero-amount "BIAYA ADM" = 7 valid transactions
    expect(result.lines).toHaveLength(7)
  })

  it("correctly categorizes credits and debits", () => {
    const result = parseBCACSV(realWorldCSV)
    const credits = result.lines.filter(l => l.credit > 0)
    const debits = result.lines.filter(l => l.debit > 0)
    expect(credits).toHaveLength(3)  // 2 TRSF CR + 1 bunga
    expect(debits).toHaveLength(4)   // 3 DB + 1 pajak
  })

  it("extracts document references", () => {
    const result = parseBCACSV(realWorldCSV)
    // First row should extract INV-2026-0001
    expect(result.lines[0].reference).toBe("INV-2026-0001")
    // Third row has PO reference
    expect(result.lines[1].reference).toBe("PO-2026-003")
    // Last debit row has VPAY reference
    expect(result.lines[5].reference).toBe("VPAY-2026-005")
  })

  it("handles large amounts in Indonesian format", () => {
    const result = parseBCACSV(realWorldCSV)
    expect(result.lines[0].credit).toBe(25750000)
    expect(result.lines[4].credit).toBe(50000000)
  })
})

// ──────────────────────────────────────────────
// Generic bank CSV parser
// ──────────────────────────────────────────────

describe("parseGenericBankCSV", () => {
  it("works with same format as BCA parser", () => {
    const csv = [
      "Tanggal,Keterangan,Debit,Credit,Saldo",
      "15/03/2026,TRF MASUK,,5.000.000,5.000.000",
    ].join("\n")
    const result = parseGenericBankCSV(csv, "Mandiri")
    expect(result.success).toBe(true)
    expect(result.bankName).toBe("Mandiri")
    expect(result.lines).toHaveLength(1)
  })
})
