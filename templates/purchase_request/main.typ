// ============================================
// Purchase Request Template
// "FORMULIR PERMINTAAN PEMBELIAN"
// ============================================

#let safe-text(value, default: "") = {
  if value == none { default } else { str(value) }
}

#let format-num(val) = { if val == none { "0" } else { str(val) } }

#let json-data = sys.inputs.data
#let data = if json-data != none and json-data != "" {
  json.decode(json-data)
} else {
  json.decode("{\"number\":\"PR-ERROR\",\"requestDate\":\"2026-01-01\",\"items\":[],\"notes\":\"\"}")
}

#let get-field(obj, field, default: "") = {
  if obj == none { return default }
  if type(obj) != dictionary { return default }
  obj.at(field, default: default)
}

#import "../_shared/brand.typ": header, footer, brand-color

#let colors = (
  primary: rgb("#1a365d"),
  text-light: rgb("#4a5568"),
  border: rgb("#cbd5e0"),
  bg-light: rgb("#f7fafc"),
)

#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2.5cm, left: 1.5cm, right: 1.5cm),
  footer: footer(label: "PR " + safe-text(get-field(data, "number"))),
)

#set text(font: "Inter", size: 10pt, fill: rgb("#1a202c"))

#header()
#v(12pt)

// Title
#align(center)[
  #text(size: 16pt, weight: "black", fill: brand-color)[FORMULIR PERMINTAAN PEMBELIAN]
  #v(4pt)
  #text(size: 11pt, weight: "bold")[Nomor: #safe-text(get-field(data, "number"))]
  #v(2pt)
  #text(size: 9pt, fill: colors.text-light)[
    Tanggal: #safe-text(get-field(data, "requestDate"))
  ]
]

#v(16pt)
#line(length: 100%, stroke: 1pt + colors.primary)
#v(12pt)

// Requester info
#let requester = get-field(data, "requester", default: (:))
#grid(
  columns: (auto, 1fr),
  column-gutter: 12pt,
  row-gutter: 6pt,
  text(weight: "bold")[Pemohon:], text[#safe-text(get-field(requester, "name"), default: "—")],
  text(weight: "bold")[Departemen:], text[#safe-text(get-field(data, "department"), default: get-field(requester, "department", default: "—"))],
  text(weight: "bold")[Prioritas:], text[#safe-text(get-field(data, "priority"), default: "NORMAL")],
)

#v(16pt)

// Items table
#text(size: 11pt, weight: "bold")[Daftar Permintaan]
#v(6pt)

#let items = get-field(data, "items", default: ())
#table(
  columns: (auto, 1fr, auto, auto),
  stroke: 0.5pt + colors.border,
  inset: 8pt,
  fill: (_, y) => if y == 0 { colors.bg-light } else { none },
  align: (x, y) => if y == 0 { center + horizon } else if x == 1 { left + horizon } else { right + horizon },

  text(weight: "bold")[Kode], text(weight: "bold")[Nama Barang], text(weight: "bold")[Qty], text(weight: "bold")[Catatan],

  ..if items.len() == 0 {
    (table.cell(colspan: 4, align: center)[#text(fill: colors.text-light)[Belum ada item]],)
  } else {
    items.map(it => (
      safe-text(get-field(it, "productCode"), default: "—"),
      safe-text(get-field(it, "productName"), default: "—"),
      format-num(get-field(it, "quantity", default: 0)),
      safe-text(get-field(it, "notes"), default: "—"),
    )).flatten()
  }
)

#v(16pt)

// Justification
#text(size: 11pt, weight: "bold")[Justifikasi]
#v(6pt)
#rect(width: 100%, stroke: 0.5pt + colors.border, inset: 10pt)[
  #text(size: 10pt)[
    #safe-text(get-field(data, "notes"), default: "Tidak ada catatan justifikasi.")
  ]
]

#v(20pt)

// Signatures
#grid(
  columns: (1fr, 1fr),
  gutter: 24pt,
  [
    #text(weight: "bold")[Pemohon] \
    #v(40pt)
    #line(length: 60%, stroke: 0.5pt) \
    #text(size: 9pt)[(#safe-text(get-field(requester, "name"), default: "..............................")) ]
  ],
  [
    #text(weight: "bold")[Disetujui Oleh] \
    #v(40pt)
    #line(length: 60%, stroke: 0.5pt) \
    #text(size: 9pt)[(.............................................)]
  ],
)
