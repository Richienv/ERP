/**
 * Bank statement CSV parsers for Indonesian banks.
 * Pure functions — no Prisma, no server actions.
 *
 * BCA e-Statement CSV comes in several variants:
 *   1. Comma-separated with DB/CR type column
 *   2. Semicolon-separated (Excel-exported)
 *   3. Separate Debit/Credit columns
 *
 * All variants use Indonesian number format: 1.000.000,00
 * Dates are DD/MM/YYYY.
 */

export interface ParsedBankLine {
  date: string        // YYYY-MM-DD (ISO format for DB storage)
  description: string
  reference?: string
  debit: number       // money out (positive number, 0 if credit)
  credit: number      // money in (positive number, 0 if debit)
}

export interface ParseResult {
  success: boolean
  lines: ParsedBankLine[]
  errors: string[]
  skippedRows: number
  bankName?: string
}

// ──────────────────────────────────────────────
// Indonesian number format helpers
// ──────────────────────────────────────────────

/**
 * Parse Indonesian number format: "1.500.000,00" → 1500000.00
 * Also handles plain numbers like "1500000" or "1500000.00"
 */
export function parseIndonesianNumber(raw: string): number {
  if (!raw) return 0
  const cleaned = raw.trim().replace(/['"]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '') return 0

  // Detect if this is Indonesian format (dots as thousands, comma as decimal)
  // vs international format (commas as thousands, dot as decimal)
  const hasIndonesianFormat = /\d\.\d{3}/.test(cleaned) || /,\d{2}$/.test(cleaned)

  if (hasIndonesianFormat) {
    // Indonesian: 1.500.000,00 → remove dots, replace comma with dot
    const normalized = cleaned.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(normalized)
    return isNaN(num) ? 0 : Math.abs(num)
  }

  // International or plain: 1,500,000.00 or 1500000
  const normalized = cleaned.replace(/,/g, '')
  const num = parseFloat(normalized)
  return isNaN(num) ? 0 : Math.abs(num)
}

/**
 * Parse DD/MM/YYYY to YYYY-MM-DD.
 * Also accepts YYYY-MM-DD passthrough.
 */
export function parseDateDDMMYYYY(raw: string): string | null {
  if (!raw) return null
  const cleaned = raw.trim().replace(/['"]/g, '')

  // Already ISO format?
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned

  // DD/MM/YYYY or DD-MM-YYYY
  const match = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (!match) return null

  const day = match[1].padStart(2, '0')
  const month = match[2].padStart(2, '0')
  const year = match[3]

  // Basic validation
  const d = parseInt(day), m = parseInt(month), y = parseInt(year)
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2099) return null

  return `${year}-${month}-${day}`
}

// ──────────────────────────────────────────────
// CSV splitting
// ──────────────────────────────────────────────

/**
 * Detect delimiter: semicolon, comma, or pipe.
 * Heuristic: check which delimiter produces the most consistent column count.
 */
export function detectDelimiter(lines: string[]): string {
  const candidates = [';', ',', '|', '\t']
  let bestDelim = ','
  let bestScore = 0

  for (const delim of candidates) {
    const counts = lines.slice(0, Math.min(10, lines.length)).map(line =>
      splitCSVLine(line, delim).length
    )
    // Score = consistency (how many lines have the same column count as the mode)
    const mode = counts.sort((a, b) =>
      counts.filter(v => v === b).length - counts.filter(v => v === a).length
    )[0]
    const score = counts.filter(c => c === mode && mode >= 3).length
    if (score > bestScore) {
      bestScore = score
      bestDelim = delim
    }
  }

  return bestDelim
}

/**
 * Split a CSV line respecting quoted fields.
 * Handles: "field with, comma", unquoted field, "field with ""escaped"" quotes"
 */
export function splitCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === delimiter) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }

  fields.push(current.trim())
  return fields
}

// ──────────────────────────────────────────────
// Column detection
// ──────────────────────────────────────────────

interface ColumnMap {
  date: number
  description: number
  branch: number       // -1 if absent
  amount: number       // -1 if separate debit/credit columns
  debit: number        // -1 if single amount column
  credit: number       // -1 if single amount column
  balance: number      // -1 if absent
  type: number         // -1 if absent (DB/CR column)
}

const DATE_HEADERS = ['tanggal', 'date', 'tgl', 'transaction date', 'posting date']
const DESC_HEADERS = ['keterangan', 'description', 'deskripsi', 'uraian', 'remark', 'narrative']
const BRANCH_HEADERS = ['cabang', 'branch', 'cab']
const AMOUNT_HEADERS = ['jumlah', 'amount', 'nominal']
const DEBIT_HEADERS = ['debit', 'debet', 'keluar', 'pengeluaran', 'money out']
const CREDIT_HEADERS = ['credit', 'kredit', 'masuk', 'penerimaan', 'money in']
const BALANCE_HEADERS = ['saldo', 'balance', 'sisa']
// "mutasi" = movement type (DB/CR), "db/cr" = debit/credit indicator
const TYPE_HEADERS = ['type', 'tipe', 'jenis', 'db/cr', 'dc', 'mutasi']

function matchHeader(header: string, candidates: string[]): boolean {
  const h = header.toLowerCase().trim()
  return candidates.some(c => h === c || h.includes(c))
}

function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {
    date: -1,
    description: -1,
    branch: -1,
    amount: -1,
    debit: -1,
    credit: -1,
    balance: -1,
    type: -1,
  }

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    if (map.date === -1 && matchHeader(h, DATE_HEADERS)) map.date = i
    else if (map.description === -1 && matchHeader(h, DESC_HEADERS)) map.description = i
    else if (map.branch === -1 && matchHeader(h, BRANCH_HEADERS)) map.branch = i
    // Check TYPE before DEBIT/CREDIT — "db/cr" contains "db" and "cr" substrings
    else if (map.type === -1 && matchHeader(h, TYPE_HEADERS)) map.type = i
    else if (map.debit === -1 && matchHeader(h, DEBIT_HEADERS)) map.debit = i
    else if (map.credit === -1 && matchHeader(h, CREDIT_HEADERS)) map.credit = i
    else if (map.amount === -1 && matchHeader(h, AMOUNT_HEADERS)) map.amount = i
    else if (map.balance === -1 && matchHeader(h, BALANCE_HEADERS)) map.balance = i
  }

  return map
}

/**
 * Detect if the first non-empty line is a header row.
 * Heuristic: headers contain known column names, data rows start with a date.
 */
function isHeaderRow(fields: string[]): boolean {
  const joined = fields.join(' ').toLowerCase()
  const headerKeywords = [...DATE_HEADERS, ...DESC_HEADERS, ...AMOUNT_HEADERS, ...DEBIT_HEADERS, ...CREDIT_HEADERS, ...BALANCE_HEADERS]
  const matchCount = headerKeywords.filter(kw => joined.includes(kw)).length
  return matchCount >= 2
}

// ──────────────────────────────────────────────
// Reference extraction
// ──────────────────────────────────────────────

/**
 * Extract a transaction reference from the description.
 * BCA descriptions often contain transfer references like:
 *   "TRSF E-BANKING DB 0123456789 PT ABC INV-2026-001"
 *   "SWITCHING CR DARI/BNI 9876543 REF:123456"
 */
function extractReference(description: string): string | undefined {
  if (!description) return undefined

  // Pattern: common ERP document numbers
  const docMatch = description.match(/(?:INV|PO|SO|GRN|PAY|DN|CN|PV|REF|VPAY)[-/]?\d{4}[-/]?\d{0,6}/i)
  if (docMatch) return docMatch[0]

  // Pattern: REF:123456 or REF 123456
  const refMatch = description.match(/REF[:\s]*(\S+)/i)
  if (refMatch) return refMatch[1]

  // Pattern: long numeric reference (10+ digits often a transfer reference)
  const numMatch = description.match(/\b(\d{10,20})\b/)
  if (numMatch) return numMatch[1]

  return undefined
}

// ──────────────────────────────────────────────
// BCA CSV Parser
// ──────────────────────────────────────────────

/**
 * Parse BCA e-Statement / KlikBCA Bisnis CSV export.
 *
 * Supports multiple BCA CSV variants:
 *   Variant A (single amount + type):
 *     Tanggal | Keterangan | Cabang | Jumlah | Saldo | DB/CR
 *
 *   Variant B (separate debit/credit):
 *     Tanggal | Keterangan | Cabang | Debit | Credit | Saldo
 *
 *   Variant C (signed amount, no type column):
 *     Date | Description | Amount | Balance
 *     (negative = debit/out, positive = credit/in)
 *
 * All variants: Indonesian number format (1.500.000,00), DD/MM/YYYY dates.
 */
export function parseBCACSV(csvContent: string): ParseResult {
  const errors: string[] = []
  const lines: ParsedBankLine[] = []
  let skippedRows = 0

  if (!csvContent || !csvContent.trim()) {
    return { success: false, lines: [], errors: ['CSV kosong (empty CSV content)'], skippedRows: 0 }
  }

  // Normalize line endings and split
  const rawLines = csvContent
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  if (rawLines.length === 0) {
    return { success: false, lines: [], errors: ['Tidak ada baris data (no data rows)'], skippedRows: 0 }
  }

  // Skip BCA preamble lines (account info, period, etc.)
  // BCA CSVs often start with: "Rekening: 1234567890" / "Periode: ..." / blank lines
  let dataStartIdx = 0
  for (let i = 0; i < Math.min(10, rawLines.length); i++) {
    const lower = rawLines[i].toLowerCase()
    if (lower.startsWith('rekening') || lower.startsWith('periode') ||
        lower.startsWith('account') || lower.startsWith('period') ||
        lower.startsWith('pt ') || lower.startsWith('cv ') ||
        lower.startsWith('no.') || lower.startsWith('nomor') ||
        lower.startsWith('---') || lower.startsWith('===')) {
      dataStartIdx = i + 1
    }
  }

  const dataLines = rawLines.slice(dataStartIdx)
  if (dataLines.length === 0) {
    return { success: false, lines: [], errors: ['Tidak ada data setelah header (no data after preamble)'], skippedRows: 0 }
  }

  // Detect delimiter
  const delimiter = detectDelimiter(dataLines)

  // Check for header row
  const firstFields = splitCSVLine(dataLines[0], delimiter)
  const hasHeader = isHeaderRow(firstFields)

  let columns: ColumnMap
  let rowStart: number

  if (hasHeader) {
    columns = detectColumns(firstFields)
    rowStart = 1
  } else {
    rowStart = 0
    // No header — assume standard BCA order by column count
    const colCount = firstFields.length
    if (colCount >= 6) {
      // Tanggal, Keterangan, Cabang, Jumlah, Saldo, DB/CR
      columns = { date: 0, description: 1, branch: 2, amount: 3, balance: 4, type: 5, debit: -1, credit: -1 }
    } else if (colCount === 5) {
      // Tanggal, Keterangan, Debit, Credit, Saldo
      columns = { date: 0, description: 1, branch: -1, debit: 2, credit: 3, balance: 4, amount: -1, type: -1 }
    } else if (colCount === 4) {
      // Date, Description, Amount, Balance (signed amount)
      columns = { date: 0, description: 1, branch: -1, amount: 2, balance: 3, debit: -1, credit: -1, type: -1 }
    } else {
      return { success: false, lines: [], errors: [`Format tidak dikenali: ${colCount} kolom (expected 4-6 columns)`], skippedRows: 0 }
    }
  }

  // Validate: must have at least date + description + some amount column
  if (columns.date === -1) {
    errors.push('Kolom tanggal tidak ditemukan (date column not found)')
  }
  if (columns.description === -1) {
    errors.push('Kolom keterangan tidak ditemukan (description column not found)')
  }
  if (columns.amount === -1 && columns.debit === -1 && columns.credit === -1) {
    errors.push('Kolom jumlah/debit/credit tidak ditemukan (amount columns not found)')
  }
  if (errors.length > 0) {
    return { success: false, lines: [], errors, skippedRows: 0 }
  }

  // Parse data rows
  for (let i = rowStart; i < dataLines.length; i++) {
    const rawLine = dataLines[i]

    // Skip summary/total rows
    const lower = rawLine.toLowerCase()
    if (lower.includes('saldo awal') || lower.includes('saldo akhir') ||
        lower.includes('opening balance') || lower.includes('closing balance') ||
        lower.includes('total') || lower.startsWith('---') || lower.startsWith('===')) {
      skippedRows++
      continue
    }

    const fields = splitCSVLine(rawLine, delimiter)
    if (fields.length < 3) {
      skippedRows++
      continue
    }

    // Parse date
    const dateStr = parseDateDDMMYYYY(fields[columns.date])
    if (!dateStr) {
      // Could be a continuation line (BCA wraps long descriptions)
      skippedRows++
      continue
    }

    // Parse description
    const description = (fields[columns.description] || '').trim()
    if (!description) {
      skippedRows++
      continue
    }

    // Parse amount
    let debit = 0
    let credit = 0

    if (columns.debit !== -1 && columns.credit !== -1) {
      // Variant B: Separate debit/credit columns
      debit = parseIndonesianNumber(fields[columns.debit] || '')
      credit = parseIndonesianNumber(fields[columns.credit] || '')
    } else if (columns.amount !== -1 && columns.type !== -1) {
      // Variant A: Single amount + DB/CR type column
      const amount = parseIndonesianNumber(fields[columns.amount] || '')
      const typeStr = (fields[columns.type] || '').trim().toUpperCase()
      if (typeStr === 'DB' || typeStr === 'D' || typeStr === 'DEBIT' || typeStr === 'DEBET') {
        debit = amount
      } else {
        credit = amount
      }
    } else if (columns.amount !== -1) {
      // Variant C: Signed amount (negative = out, positive = in)
      const rawAmount = (fields[columns.amount] || '').trim()
      const isNegative = rawAmount.startsWith('-') || rawAmount.startsWith('(')
      const amount = parseIndonesianNumber(rawAmount)
      if (isNegative) {
        debit = amount
      } else {
        credit = amount
      }
    }

    // Skip zero-amount rows (sometimes BCA includes fee descriptions with no amount)
    if (debit === 0 && credit === 0) {
      skippedRows++
      continue
    }

    // Extract reference from description
    const reference = extractReference(description)

    lines.push({ date: dateStr, description, reference, debit, credit })
  }

  if (lines.length === 0 && errors.length === 0) {
    errors.push('Tidak ada transaksi yang berhasil di-parse (no transactions parsed)')
  }

  return {
    success: lines.length > 0,
    lines,
    errors,
    skippedRows,
    bankName: 'BCA',
  }
}

/**
 * Generic bank CSV parser — tries to auto-detect format.
 * Works for BCA, Mandiri, BNI, and other Indonesian banks that use
 * similar CSV formats with DD/MM/YYYY dates and Indonesian numbers.
 */
export function parseGenericBankCSV(csvContent: string, bankName?: string): ParseResult {
  // For now, use the BCA parser which handles the common Indonesian variants.
  // Future: add bank-specific parsers for Mandiri, BNI, etc.
  const result = parseBCACSV(csvContent)
  if (bankName) {
    result.bankName = bankName
  }
  return result
}
