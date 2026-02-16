// ============================================
// Faktur Pajak (Tax Invoice) Template
// Indonesian DJP Format
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
  json.decode("{\"number\":\"000-00.00000000\",\"date\":\"2025-01-01\",\"seller\":{\"name\":\"ERROR\",\"npwp\":\"\",\"address\":\"\"},\"buyer\":{\"name\":\"ERROR\",\"npwp\":\"\",\"address\":\"\"},\"items\":[],\"summary\":{\"dpp\":0,\"ppn\":0,\"total\":0}}")
}

#let get-field(obj, field, default: "") = {
  if obj == none { return default }
  if type(obj) != dictionary { return default }
  obj.at(field, default: default)
}

// ============================================
// PAGE SETUP
// ============================================
#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2cm, left: 2cm, right: 2cm),
)

#set text(font: "Inter", size: 9pt, fill: rgb("#1a202c"))

#let colors = (
  primary: rgb("#1a365d"),
  text-light: rgb("#4a5568"),
  border: rgb("#cbd5e0"),
  bg-light: rgb("#f7fafc"),
)

// ============================================
// HEADER
// ============================================
#align(center)[
  #text(size: 16pt, weight: "black", fill: colors.primary)[FAKTUR PAJAK]
  #v(4pt)
  #text(size: 10pt, weight: "bold")[
    Nomor: #safe-text(get-field(data, "number"))
  ]
  #v(2pt)
  #text(size: 9pt, fill: colors.text-light)[
    Tanggal: #safe-text(get-field(data, "date"))
  ]
]

#v(8pt)
#line(length: 100%, stroke: 1.5pt + colors.primary)
#v(12pt)

// ============================================
// SELLER (PKP)
// ============================================
#let seller = get-field(data, "seller", default: (:))

#rect(
  width: 100%,
  stroke: 0.5pt + colors.border,
  inset: 10pt,
)[
  #text(size: 8pt, weight: "bold", fill: colors.text-light)[PENGUSAHA KENA PAJAK (PKP)]
  #v(6pt)
  #grid(
    columns: (100pt, auto),
    gutter: 4pt,
    text(size: 9pt, fill: colors.text-light)[Nama],
    text(size: 9pt, weight: "bold")[: #safe-text(get-field(seller, "name"))],
    text(size: 9pt, fill: colors.text-light)[NPWP],
    text(size: 9pt, weight: "bold", font: "Courier New")[: #safe-text(get-field(seller, "npwp"))],
    text(size: 9pt, fill: colors.text-light)[Alamat],
    text(size: 9pt)[: #safe-text(get-field(seller, "address"))],
  )
]

#v(8pt)

// ============================================
// BUYER
// ============================================
#let buyer = get-field(data, "buyer", default: (:))

#rect(
  width: 100%,
  stroke: 0.5pt + colors.border,
  inset: 10pt,
)[
  #text(size: 8pt, weight: "bold", fill: colors.text-light)[PEMBELI BARANG KENA PAJAK / PENERIMA JASA KENA PAJAK]
  #v(6pt)
  #grid(
    columns: (100pt, auto),
    gutter: 4pt,
    text(size: 9pt, fill: colors.text-light)[Nama],
    text(size: 9pt, weight: "bold")[: #safe-text(get-field(buyer, "name"))],
    text(size: 9pt, fill: colors.text-light)[NPWP],
    text(size: 9pt, weight: "bold", font: "Courier New")[: #safe-text(get-field(buyer, "npwp"))],
    text(size: 9pt, fill: colors.text-light)[Alamat],
    text(size: 9pt)[: #safe-text(get-field(buyer, "address"))],
  )
]

#v(12pt)

// ============================================
// ITEMS TABLE
// ============================================
#let items = get-field(data, "items", default: ())

#table(
  columns: (auto, 1fr, auto, auto, auto),
  stroke: 0.5pt + colors.border,
  fill: (col, row) => if row == 0 { colors.primary } else if calc.rem(row, 2) == 0 { colors.bg-light } else { white },

  text(size: 8pt, weight: "bold", fill: white)[No.],
  text(size: 8pt, weight: "bold", fill: white)[Nama Barang / Jasa],
  text(size: 8pt, weight: "bold", fill: white)[Qty],
  text(size: 8pt, weight: "bold", fill: white)[Harga Satuan],
  text(size: 8pt, weight: "bold", fill: white)[Jumlah],

  ..items.enumerate().map(((idx, item)) => {
    (
      text(size: 9pt)[#{idx + 1}],
      text(size: 9pt)[#safe-text(get-field(item, "description"))],
      text(size: 9pt, weight: "bold")[#format-num(get-field(item, "qty"))],
      align(right, text(size: 9pt, font: "Courier New")[#format-num(get-field(item, "unit_price"))]),
      align(right, text(size: 9pt, weight: "bold", font: "Courier New")[#format-num(get-field(item, "total"))]),
    )
  }).flatten()
)

#v(12pt)

// ============================================
// SUMMARY
// ============================================
#let summary = get-field(data, "summary", default: (:))

#align(right)[
  #rect(
    width: 50%,
    stroke: 0.5pt + colors.border,
    inset: 10pt,
  )[
    #grid(
      columns: (1fr, auto),
      gutter: 6pt,
      text(size: 9pt, fill: colors.text-light)[Dasar Pengenaan Pajak (DPP)],
      align(right, text(size: 9pt, weight: "bold", font: "Courier New")[Rp #format-num(get-field(summary, "dpp"))]),
      text(size: 9pt, fill: colors.text-light)[PPN (11%)],
      align(right, text(size: 9pt, weight: "bold", font: "Courier New")[Rp #format-num(get-field(summary, "ppn"))]),
      line(length: 100%, stroke: 0.5pt + colors.border),
      [],
      text(size: 10pt, weight: "bold")[Total],
      align(right, text(size: 10pt, weight: "black", font: "Courier New")[Rp #format-num(get-field(summary, "total"))]),
    )
  ]
]

#v(24pt)

// ============================================
// SIGNATURES
// ============================================
#grid(
  columns: (1fr, 1fr),
  gutter: 20pt,
  [
    #align(center)[
      #text(size: 8pt, fill: colors.text-light)[#safe-text(get-field(data, "date"))]
      #v(4pt)
      #text(size: 9pt, weight: "bold")[Penjual]
      #v(50pt)
      #line(length: 60%, stroke: 0.5pt + colors.border)
      #v(2pt)
      #text(size: 8pt)[#safe-text(get-field(seller, "name"))]
    ]
  ],
  [
    #align(center)[
      #v(4pt)
      #text(size: 9pt, weight: "bold")[Pembeli]
      #v(50pt)
      #line(length: 60%, stroke: 0.5pt + colors.border)
      #v(2pt)
      #text(size: 8pt)[#safe-text(get-field(buyer, "name"))]
    ]
  ],
)
