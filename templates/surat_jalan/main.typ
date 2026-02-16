// ============================================
// Surat Jalan (Delivery Note) Template
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
  json.decode("{\"number\":\"SJ-ERROR\",\"date\":\"2025-01-01\",\"customer\":{\"name\":\"ERROR\",\"address\":\"\"},\"sales_order\":\"SO-000\",\"items\":[],\"notes\":\"\",\"company\":{\"name\":\"PT. Textile ERP\",\"address\":\"\"}}")
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
  text: rgb("#1a202c"),
  text-light: rgb("#4a5568"),
  border: rgb("#cbd5e0"),
  bg-light: rgb("#f7fafc"),
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
      Surat Jalan #safe-text(get-field(data, "number")) — Dicetak otomatis oleh sistem ERP
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
#let customer = get-field(data, "customer", default: (:))

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
      #text(size: 18pt, weight: "black", fill: colors.primary)[SURAT JALAN]
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
    #text(size: 8pt, weight: "bold", fill: colors.text-light)[KEPADA:]
    #v(4pt)
    #text(weight: "bold")[#safe-text(get-field(customer, "name"))]
    #v(2pt)
    #text(size: 9pt, fill: colors.text-light)[#safe-text(get-field(customer, "address"))]
  ],
  [
    #text(size: 8pt, weight: "bold", fill: colors.text-light)[DETAIL:]
    #v(4pt)
    #grid(
      columns: (auto, auto),
      gutter: 4pt,
      text(size: 9pt, fill: colors.text-light)[Tanggal:],
      text(size: 9pt, weight: "bold")[#safe-text(get-field(data, "date"))],
      text(size: 9pt, fill: colors.text-light)[No. SO:],
      text(size: 9pt, weight: "bold")[#safe-text(get-field(data, "sales_order"))],
      text(size: 9pt, fill: colors.text-light)[Ekspedisi:],
      text(size: 9pt, weight: "bold")[#safe-text(get-field(data, "expedition"), default: "—")],
    )
  ]
)

#v(16pt)

// ============================================
// ITEMS TABLE
// ============================================
#let items = get-field(data, "items", default: ())

#table(
  columns: (auto, 1fr, auto, auto, auto),
  stroke: 0.5pt + colors.border,
  fill: (col, row) => if row == 0 { colors.primary } else if calc.rem(row, 2) == 0 { colors.bg-light } else { white },

  // Header
  text(size: 8pt, weight: "bold", fill: white)[No.],
  text(size: 8pt, weight: "bold", fill: white)[Deskripsi],
  text(size: 8pt, weight: "bold", fill: white)[Kode],
  text(size: 8pt, weight: "bold", fill: white)[Qty],
  text(size: 8pt, weight: "bold", fill: white)[Satuan],

  // Rows
  ..items.enumerate().map(((idx, item)) => {
    (
      text(size: 9pt)[#{idx + 1}],
      text(size: 9pt)[#safe-text(get-field(item, "description"))],
      text(size: 8pt, style: "italic")[#safe-text(get-field(item, "code"))],
      text(size: 9pt, weight: "bold")[#format-num(get-field(item, "qty"))],
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
    #text(size: 8pt, weight: "bold", fill: colors.text-light)[Disiapkan oleh]
    #v(40pt)
    #line(length: 80%, stroke: 0.5pt + colors.border)
    #v(2pt)
    #text(size: 8pt)[Gudang]
  ],
  align(center)[
    #text(size: 8pt, weight: "bold", fill: colors.text-light)[Pengirim]
    #v(40pt)
    #line(length: 80%, stroke: 0.5pt + colors.border)
    #v(2pt)
    #text(size: 8pt)[Driver]
  ],
  align(center)[
    #text(size: 8pt, weight: "bold", fill: colors.text-light)[Penerima]
    #v(40pt)
    #line(length: 80%, stroke: 0.5pt + colors.border)
    #v(2pt)
    #text(size: 8pt)[Pelanggan]
  ],
)
