#let json-data = sys.inputs.data
#let data = if json-data != none and json-data != "" {
  json.decode(json-data)
} else {
  json.decode("{\"company_name\":\"ERP System\",\"period_label\":\"N/A\",\"status\":\"PENDING_APPROVAL\",\"generated_at\":\"-\",\"summary\":{\"employees\":0,\"gross\":0,\"deductions\":0,\"net\":0,\"overtime_hours\":0},\"rows\":[]}")
}

#let get-field(obj, field, default: none) = {
  if obj == none { return default }
  if type(obj) != dictionary { return default }
  obj.at(field, default: default)
}

#let idr(amount) = {
  let value = if amount == none { 0 } else { amount }
  "Rp " + str(value)
}

#let company-name = get-field(data, "company_name", default: "ERP System")
#let period-label = get-field(data, "period_label", default: "N/A")
#let status = get-field(data, "status", default: "PENDING_APPROVAL")
#let generated-at = get-field(data, "generated_at", default: "-")
#let posted-at = get-field(data, "posted_at", default: "-")
#let journal-reference = get-field(data, "journal_reference", default: "-")

#let summary = get-field(data, "summary", default: (:))
#let employees = get-field(summary, "employees", default: 0)
#let gross = get-field(summary, "gross", default: 0)
#let deductions = get-field(summary, "deductions", default: 0)
#let net = get-field(summary, "net", default: 0)
#let overtime-hours = get-field(summary, "overtime_hours", default: 0)

#let rows = get-field(data, "rows", default: ())

#set page(paper: "a4", margin: (top: 1.5cm, bottom: 1.5cm, left: 1.5cm, right: 1.5cm))
#set text(size: 9pt)

#align(left)[
  #text(size: 16pt, weight: "bold")[Laporan Payroll]
  #v(4pt)
  #text(weight: "bold")[#company-name]
]

#v(10pt)
#grid(
  columns: (1fr, 1fr),
  column-gutter: 20pt,
  row-gutter: 4pt,
  [Periode], [#period-label],
  [Status], [#status],
  [Generated], [#generated-at],
  [Posted], [#posted-at],
  [Ref Jurnal], [#journal-reference]
)

#v(12pt)
#text(size: 11pt, weight: "bold")[Ringkasan]
#v(6pt)
#grid(
  columns: (1fr, 1fr, 1fr, 1fr, 1fr),
  column-gutter: 12pt,
  [Karyawan: #employees],
  [Gaji Kotor: #idr(gross)],
  [Potongan: #idr(deductions)],
  [Gaji Bersih: #idr(net)],
  [Lembur (Jam): #overtime-hours]
)

#v(12pt)
#text(size: 11pt, weight: "bold")[Detail Karyawan]
#v(6pt)
#table(
  columns: (auto, 1fr, auto, auto, auto, auto, auto),
  stroke: 0.4pt + luma(180),
  inset: 5pt,
  align: (x, y) => if y == 0 { center + horizon } else if x == 1 { left + horizon } else { right + horizon },
  text(weight: "bold")[Kode],
  text(weight: "bold")[Nama],
  text(weight: "bold")[Hadir],
  text(weight: "bold")[Lembur],
  text(weight: "bold")[Gaji Kotor],
  text(weight: "bold")[Potongan],
  text(weight: "bold")[Gaji Bersih],
  ..if rows.len() > 0 {
    for row in rows {
      let employee-code = get-field(row, "employee_code", default: "-")
      let employee-name = get-field(row, "employee_name", default: "-")
      let attendance-days = get-field(row, "attendance_days", default: 0)
      let overtime = get-field(row, "overtime_hours", default: 0)
      let gross-salary = get-field(row, "gross_salary", default: 0)
      let row-deductions = get-field(row, "deductions", default: 0)
      let net-salary = get-field(row, "net_salary", default: 0)
      (
        [#employee-code],
        [#employee-name],
        [#attendance-days],
        [#overtime],
        [#idr(gross-salary)],
        [#idr(row-deductions)],
        [#idr(net-salary)]
      )
    }
  } else {
    ([-], [Data payroll belum tersedia], [0], [0], [#idr(0)], [#idr(0)], [#idr(0)])
  }
)
