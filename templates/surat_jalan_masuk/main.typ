// ============================================
// Surat Jalan Masuk (Incoming Delivery Note)
// ============================================

#let safe-text(value, default: "") = {
  if value == none { default } else { str(value) }
}

#let format-num(val) = {
  if val == none { "0" } else { str(val) }
}

// ============================================
// DATA INJECTION
// ============================================
#let json-data = sys.inputs.data
#let data = if json-data != none and json-data != "" {
  json.decode(json-data)
} else {
  json.decode("{\"number\":\"SJM-ERROR\",\"date\":\"2025-01-01\",\"supplier\":{\"name\":\"ERROR\",\"address\":\"\"},\"purchase_order\":\"PO-000\",\"warehouse\":\"Gudang Utama\",\"items\":[],\"notes\":\"\",\"company\":{\"name\":\"PT. Textile ERP\",\"address\":\"\"}}")
}

#let get-field(obj, field, default: "") = {
  if obj == none { return default }
  if type(obj) != dictionary { return default }
  obj.at(field, default: default)
}

// ============================================
// BRAND COLORS
// ============================================
#let colors = (
  primary: rgb("#1a365d"),
  accent: rgb("#2b6cb0"),
  text: rgb("#1a202c"),
  text-light: rgb("#4a5568"),
  border: rgb("#cbd5e0"),
  bg-light: rgb("#f7fafc"),
  success: rgb("#276749"),
  danger: rgb("#c53030"),
)

// ============================================
// PAGE SETUP
// ============================================
#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2.5cm, left: 2cm, right: 2cm),
  footer: [
    #line(length: 100%, stroke: 0.5pt + colors.border)
    #v(4pt)
    #text(size: 7pt, fill: colors.text-light)[
      Surat Jalan Masuk #safe-text(get-field(data, "number")) — Dicetak otomatis oleh sistem ERP
      #h(1fr)
      Halaman #counter(page).display() dari #locate(loc => counter(page).final(loc).first())
    ]
  ]
)

#set text(font: "Inter", size: 10pt, fill: colors.text)

// ============================================
// HEADER
// ============================================
#let company = get-field(data, "company", default: (:))
#let supplier = get-field(data, "supplier", default: (:))

#grid(
  columns: (1fr, auto),
  gutter: 20pt,
  [
    #text(size: 14pt, weight: "black", fill: colors.primary)[
      #safe-text(get-field(company, "name"), default: "PT. Textile ERP")
    ]
    #v(2pt)
    #text(size: 8pt, fill: colors.text-light)[
      #safe-text(get-field(company, "address"))
    ]
  ],
  [
    #align(right)[
      #text(size: 16pt, weight: "black", fill: colors.primary)[SURAT JALAN MASUK]
      #v(2pt)
      #text(size: 10pt, weight: "bold")[#safe-text(get-field(data, "number"))]
    ]
  ]
)

#v(8pt)
#line(length: 100%, stroke: 2pt + colors.primary)
#v(12pt)

// ============================================
// INFO GRID
// ============================================
#grid(
  columns: (1fr, 1fr),
  gutter: 20pt,
  [
    #text(size: 8pt, weight: "bold", fill: colors.text-light)[DARI SUPPLIER:]
    #v(4pt)
    #text(weight: "bold")[#safe-text(get-field(supplier, "name"))]
    #v(2pt)
    #text(size: 9pt, fill: colors.text-light)[#safe-text(get-field(supplier, "address"))]
  ],
  [
    #text(size: 8pt, weight: "bold", fill: colors.text-light)[DETAIL PENERIMAAN:]
    #v(4pt)
    #grid(
      columns: (auto, auto),
      gutter: 4pt,
      text(size: 9pt, fill: colors.text-light)[No. SJM:],
      text(size: 9pt, weight: "bold")[#safe-text(get-field(data, "number"))],
      text(size: 9pt, fill: colors.text-light)[No. PO:],
      text(size: 9pt, weight: "bold")[#safe-text(get-field(data, "purchase_order"))],
      text(size: 9pt, fill: colors.text-light)[Tanggal Terima:],
      text(size: 9pt, weight: "bold")[#safe-text(get-field(data, "date"))],
      text(size: 9pt, fill: colors.text-light)[Gudang Tujuan:],
      text(size: 9pt, weight: "bold")[#safe-text(get-field(data, "warehouse"))],
      text(size: 9pt, fill: colors.text-light)[Penerima:],
      text(size: 9pt, weight: "bold")[#safe-text(get-field(data, "received_by"), default: "—")],
    )
  ]
)

#v(16pt)

// ============================================
// ITEMS TABLE
// ============================================
#let items = get-field(data, "items", default: ())

#table(
  columns: (auto, 1fr, auto, auto, auto, auto, auto, auto),
  stroke: 0.5pt + colors.border,
  fill: (col, row) => if row == 0 { colors.primary } else if calc.rem(row, 2) == 0 { colors.bg-light } else { white },

  // Header
  text(size: 7pt, weight: "bold", fill: white)[No.],
  text(size: 7pt, weight: "bold", fill: white)[Deskripsi],
  text(size: 7pt, weight: "bold", fill: white)[Kode],
  text(size: 7pt, weight: "bold", fill: white)[Qty Pesan],
  text(size: 7pt, weight: "bold", fill: white)[Qty Terima],
  text(size: 7pt, weight: "bold", fill: white)[Qty OK],
  text(size: 7pt, weight: "bold", fill: white)[Qty Reject],
  text(size: 7pt, weight: "bold", fill: white)[Satuan],

  // Rows
  ..items.enumerate().map(((idx, item)) => {
    (
      text(size: 9pt)[#{idx + 1}],
      text(size: 9pt)[#safe-text(get-field(item, "description"))],
      text(size: 8pt, style: "italic")[#safe-text(get-field(item, "code"))],
      text(size: 9pt)[#format-num(get-field(item, "qty_ordered"))],
      text(size: 9pt, weight: "bold")[#format-num(get-field(item, "qty_received"))],
      text(size: 9pt, weight: "bold", fill: colors.success)[#format-num(get-field(item, "qty_accepted"))],
      text(size: 9pt, weight: "bold", fill: colors.danger)[#format-num(get-field(item, "qty_rejected"))],
      text(size: 9pt)[#safe-text(get-field(item, "unit"), default: "pcs")],
    )
  }).flatten()
)

#v(16pt)

// ============================================
// NOTES
// ============================================
#let notes = safe-text(get-field(data, "notes"))
#if notes != "" [
  #rect(
    width: 100%,
    stroke: 0.5pt + colors.border,
    fill: colors.bg-light,
    inset: 8pt,
  )[
    #text(size: 8pt, weight: "bold", fill: colors.text-light)[CATATAN:]
    #v(4pt)
    #text(size: 9pt)[#notes]
  ]
  #v(16pt)
]

// ============================================
// SIGNATURES
// ============================================
#v(1fr)

#grid(
  columns: (1fr, 1fr, 1fr),
  gutter: 20pt,
  align(center)[
    #text(size: 8pt, weight: "bold", fill: colors.text-light)[Pengirim (Supplier)]
    #v(40pt)
    #line(length: 80%, stroke: 0.5pt + colors.border)
    #v(2pt)
    #text(size: 8pt)[Nama & Tanda Tangan]
  ],
  align(center)[
    #text(size: 8pt, weight: "bold", fill: colors.text-light)[Penerima Gudang]
    #v(40pt)
    #line(length: 80%, stroke: 0.5pt + colors.border)
    #v(2pt)
    #text(size: 8pt)[#safe-text(get-field(data, "received_by"), default: "________________")]
  ],
  align(center)[
    #text(size: 8pt, weight: "bold", fill: colors.text-light)[Diperiksa Oleh]
    #v(40pt)
    #line(length: 80%, stroke: 0.5pt + colors.border)
    #v(2pt)
    #text(size: 8pt)[Kepala Gudang]
  ],
)
