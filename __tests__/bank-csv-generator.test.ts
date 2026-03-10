import { describe, it, expect } from "vitest"
import {
  getBankCode,
  generateBankFile,
  BCA_FORMAT,
  GENERIC_CSV_FORMAT,
  BANK_CODES,
  type PaymentExportRow,
} from "@/lib/bank-csv-generator"

const sampleRows: PaymentExportRow[] = [
  {
    transferDate: "10/03/2026",
    beneficiaryAccount: "1234567890",
    beneficiaryName: "PT Tekstil Jaya",
    beneficiaryBank: "BCA",
    beneficiaryBankCode: "014",
    amount: 5000000,
    remark: "VPAY-2026-001",
    reference: "VPAY-2026-001",
  },
  {
    transferDate: "10/03/2026",
    beneficiaryAccount: "9876543210",
    beneficiaryName: "CV Benang Mulia",
    beneficiaryBank: "MANDIRI",
    beneficiaryBankCode: "008",
    amount: 12500000,
    remark: "Invoice #INV-123",
    reference: "VPAY-2026-002",
  },
]

describe("getBankCode", () => {
  it("returns correct code for known banks", () => {
    expect(getBankCode("BCA")).toBe("014")
    expect(getBankCode("Bank Mandiri")).toBe("008")
    expect(getBankCode("BNI")).toBe("009")
    expect(getBankCode("BRI")).toBe("002")
    expect(getBankCode("BSI")).toBe("451")
  })

  it("is case insensitive", () => {
    expect(getBankCode("bca")).toBe("014")
    expect(getBankCode("Bank bni")).toBe("009")
  })

  it("returns 000 for unknown banks", () => {
    expect(getBankCode("Unknown Bank")).toBe("000")
    expect(getBankCode("")).toBe("000")
  })
})

describe("generateBankFile - BCA format", () => {
  it("generates pipe-delimited file without header", () => {
    const result = generateBankFile(sampleRows, BCA_FORMAT)
    const lines = result.split("\n")
    expect(lines).toHaveLength(2) // no header row
    // First row: TransferDate|BenefAccNo|BenefName|Amount|Remark|BankCode
    expect(lines[0]).toBe("10/03/2026|1234567890|PT Tekstil Jaya|5000000|VPAY-2026-001|014")
    expect(lines[1]).toBe("10/03/2026|9876543210|CV Benang Mulia|12500000|Invoice #INV-123|008")
  })

  it("truncates beneficiary name to 35 chars", () => {
    const longNameRow: PaymentExportRow[] = [{
      ...sampleRows[0],
      beneficiaryName: "PT Perusahaan Tekstil Indonesia Sangat Panjang Sekali",
    }]
    const result = generateBankFile(longNameRow, BCA_FORMAT)
    const name = result.split("|")[2]
    expect(name.length).toBeLessThanOrEqual(35)
  })

  it("truncates remark to 40 chars", () => {
    const longRemarkRow: PaymentExportRow[] = [{
      ...sampleRows[0],
      remark: "A".repeat(50),
    }]
    const result = generateBankFile(longRemarkRow, BCA_FORMAT)
    const parts = result.split("|")
    expect(parts[4].length).toBeLessThanOrEqual(40)
  })

  it("rounds amount to whole number", () => {
    const decimalRow: PaymentExportRow[] = [{
      ...sampleRows[0],
      amount: 1500000.75,
    }]
    const result = generateBankFile(decimalRow, BCA_FORMAT)
    expect(result).toContain("|1500001|")
  })
})

describe("generateBankFile - Generic CSV format", () => {
  it("generates CSV with header row", () => {
    const result = generateBankFile(sampleRows, GENERIC_CSV_FORMAT)
    const lines = result.split("\n")
    expect(lines).toHaveLength(3) // 1 header + 2 data rows
    expect(lines[0]).toBe('"Tanggal","Nama Penerima","No Rekening","Bank","Kode Bank","Jumlah","Keterangan","Referensi"')
  })

  it("wraps values in quotes for CSV", () => {
    const result = generateBankFile(sampleRows, GENERIC_CSV_FORMAT)
    const lines = result.split("\n")
    // Data row should be quoted
    expect(lines[1]).toContain('"PT Tekstil Jaya"')
    expect(lines[1]).toContain('"5000000"')
  })

  it("escapes double quotes in values", () => {
    const quotedRow: PaymentExportRow[] = [{
      ...sampleRows[0],
      beneficiaryName: 'PT "Jaya" Tekstil',
    }]
    const result = generateBankFile(quotedRow, GENERIC_CSV_FORMAT)
    expect(result).toContain('PT ""Jaya"" Tekstil')
  })

  it("handles empty rows", () => {
    const result = generateBankFile([], GENERIC_CSV_FORMAT)
    const lines = result.split("\n")
    expect(lines).toHaveLength(1) // header only
  })
})

describe("BANK_CODES", () => {
  it("contains major Indonesian banks", () => {
    expect(Object.keys(BANK_CODES)).toContain("BCA")
    expect(Object.keys(BANK_CODES)).toContain("MANDIRI")
    expect(Object.keys(BANK_CODES)).toContain("BNI")
    expect(Object.keys(BANK_CODES)).toContain("BRI")
    expect(Object.keys(BANK_CODES)).toContain("BSI")
    expect(Object.keys(BANK_CODES).length).toBeGreaterThanOrEqual(13)
  })
})
