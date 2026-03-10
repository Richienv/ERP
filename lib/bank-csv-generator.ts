// Bank format presets and CSV generation for bulk vendor payments

export interface BankFormatColumn {
  header: string
  field: string // key from PaymentExportRow
  width?: number // for fixed-width formats
  transform?: (value: any) => string
}

export interface BankFormat {
  name: string
  columns: BankFormatColumn[]
  delimiter: string
  extension: string
  headerRow: boolean
  encoding?: string
}

export interface PaymentExportRow {
  transferDate: string    // DD/MM/YYYY
  beneficiaryAccount: string
  beneficiaryName: string
  beneficiaryBank: string
  beneficiaryBankCode: string
  amount: number          // whole IDR, no decimals
  remark: string
  reference: string
}

// Indonesian bank codes (BI code)
export const BANK_CODES: Record<string, string> = {
  'BCA': '014',
  'MANDIRI': '008',
  'BNI': '009',
  'BRI': '002',
  'CIMB': '022',
  'DANAMON': '011',
  'PERMATA': '013',
  'BTN': '200',
  'MEGA': '426',
  'OCBC': '028',
  'PANIN': '019',
  'MAYBANK': '016',
  'BSI': '451',
}

// Lookup bank code from bank name string
export function getBankCode(bankName: string): string {
  if (!bankName) return '000'
  const upper = bankName.toUpperCase()
  for (const [key, code] of Object.entries(BANK_CODES)) {
    if (upper.includes(key)) return code
  }
  return '000'
}

export const BCA_FORMAT: BankFormat = {
  name: 'KlikBCA Bisnis',
  columns: [
    { header: 'TransferDate', field: 'transferDate' },
    { header: 'BenefAccNo', field: 'beneficiaryAccount' },
    { header: 'BenefName', field: 'beneficiaryName', transform: (v) => String(v).substring(0, 35) },
    { header: 'Amount', field: 'amount', transform: (v) => String(Math.round(Number(v))) },
    { header: 'Remark', field: 'remark', transform: (v) => String(v).substring(0, 40) },
    { header: 'BankCode', field: 'beneficiaryBankCode' },
  ],
  delimiter: '|',
  extension: 'txt',
  headerRow: false,
}

export const GENERIC_CSV_FORMAT: BankFormat = {
  name: 'CSV Umum',
  columns: [
    { header: 'Tanggal', field: 'transferDate' },
    { header: 'Nama Penerima', field: 'beneficiaryName' },
    { header: 'No Rekening', field: 'beneficiaryAccount' },
    { header: 'Bank', field: 'beneficiaryBank' },
    { header: 'Kode Bank', field: 'beneficiaryBankCode' },
    { header: 'Jumlah', field: 'amount', transform: (v) => String(Math.round(Number(v))) },
    { header: 'Keterangan', field: 'remark' },
    { header: 'Referensi', field: 'reference' },
  ],
  delimiter: ',',
  extension: 'csv',
  headerRow: true,
}

export const BANK_FORMATS: BankFormat[] = [BCA_FORMAT, GENERIC_CSV_FORMAT]

export function generateBankFile(rows: PaymentExportRow[], format: BankFormat): string {
  const lines: string[] = []

  if (format.headerRow) {
    lines.push(format.columns.map(c => `"${c.header}"`).join(format.delimiter))
  }

  for (const row of rows) {
    const values = format.columns.map(col => {
      const raw = (row as any)[col.field] ?? ''
      const value = col.transform ? col.transform(raw) : String(raw)
      // Escape delimiter and quotes for CSV
      if (format.delimiter === ',') {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
    lines.push(values.join(format.delimiter))
  }

  return lines.join('\n')
}

export function downloadBankFile(content: string, filename: string, format: BankFormat): void {
  const bom = format.extension === 'csv' ? '\uFEFF' : ''
  const blob = new Blob([bom + content], { type: 'text/plain;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.${format.extension}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
