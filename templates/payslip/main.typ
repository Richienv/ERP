#let json-data = sys.inputs.data
#let data = if json-data != none and json-data != "" {
  json.decode(json-data)
} else {
  json.decode("{\"company_name\":\"ERP System\",\"period_label\":\"N/A\",\"employee\":{\"id\":\"-\",\"name\":\"-\",\"department\":\"-\",\"position\":\"-\",\"email\":\"-\"},\"payroll\":{\"attendance_days\":0,\"leave_days\":0,\"late_count\":0,\"overtime_hours\":0,\"basic_salary\":0,\"transport_allowance\":0,\"meal_allowance\":0,\"position_allowance\":0,\"overtime_pay\":0,\"bpjs_kesehatan\":0,\"bpjs_ketenagakerjaan\":0,\"pph21\":0,\"gross_salary\":0,\"total_deductions\":0,\"net_salary\":0}}")
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
#let generated-at = get-field(data, "generated_at", default: "-")
#let posted-at = get-field(data, "posted_at", default: "-")
#let journal-reference = get-field(data, "journal_reference", default: "-")

#let employee = get-field(data, "employee", default: (:))
#let employee-id = get-field(employee, "id", default: "-")
#let employee-name = get-field(employee, "name", default: "-")
#let department = get-field(employee, "department", default: "-")
#let position = get-field(employee, "position", default: "-")
#let email = get-field(employee, "email", default: "-")

#let payroll = get-field(data, "payroll", default: (:))
#let attendance-days = get-field(payroll, "attendance_days", default: 0)
#let leave-days = get-field(payroll, "leave_days", default: 0)
#let late-count = get-field(payroll, "late_count", default: 0)
#let overtime-hours = get-field(payroll, "overtime_hours", default: 0)
#let basic-salary = get-field(payroll, "basic_salary", default: 0)
#let transport-allowance = get-field(payroll, "transport_allowance", default: 0)
#let meal-allowance = get-field(payroll, "meal_allowance", default: 0)
#let position-allowance = get-field(payroll, "position_allowance", default: 0)
#let overtime-pay = get-field(payroll, "overtime_pay", default: 0)
#let bpjs-kesehatan = get-field(payroll, "bpjs_kesehatan", default: 0)
#let bpjs-ketenagakerjaan = get-field(payroll, "bpjs_ketenagakerjaan", default: 0)
#let pph21 = get-field(payroll, "pph21", default: 0)
#let gross-salary = get-field(payroll, "gross_salary", default: 0)
#let total-deductions = get-field(payroll, "total_deductions", default: 0)
#let net-salary = get-field(payroll, "net_salary", default: 0)

#set page(paper: "a4", margin: (top: 1.6cm, bottom: 1.6cm, left: 1.8cm, right: 1.8cm))
#set text(size: 9pt)

#align(left)[
  #text(size: 16pt, weight: "bold")[Slip Gaji]
  #v(4pt)
  #text(weight: "bold")[#company-name]
]

#v(10pt)
#grid(
  columns: (1fr, 1fr),
  column-gutter: 18pt,
  row-gutter: 3pt,
  [Periode], [#period-label],
  [Generated], [#generated-at],
  [Posted], [#posted-at],
  [Ref Jurnal], [#journal-reference]
)

#v(12pt)
#text(size: 11pt, weight: "bold")[Informasi Karyawan]
#v(4pt)
#grid(
  columns: (1fr, 1fr),
  column-gutter: 18pt,
  row-gutter: 3pt,
  [NIK], [#employee-id],
  [Nama], [#employee-name],
  [Departemen], [#department],
  [Posisi], [#position],
  [Email], [#email]
)

#v(12pt)
#text(size: 11pt, weight: "bold")[Ringkasan Kehadiran]
#v(4pt)
#grid(
  columns: (1fr, 1fr, 1fr, 1fr),
  column-gutter: 12pt,
  [Hadir: #attendance-days],
  [Cuti: #leave-days],
  [Terlambat: #late-count],
  [Lembur (Jam): #overtime-hours]
)

#v(12pt)
#text(size: 11pt, weight: "bold")[Rincian Pendapatan]
#v(4pt)
#table(
  columns: (2fr, 1fr),
  stroke: 0.4pt + luma(180),
  inset: 5pt,
  align: (x, y) => if x == 0 { left + horizon } else { right + horizon },
  text(weight: "bold")[Komponen],
  text(weight: "bold")[Jumlah],
  [Gaji Pokok], [#idr(basic-salary)],
  [Tunjangan Transport], [#idr(transport-allowance)],
  [Tunjangan Makan], [#idr(meal-allowance)],
  [Tunjangan Posisi], [#idr(position-allowance)],
  [Upah Lembur], [#idr(overtime-pay)],
  [Gaji Kotor], [#idr(gross-salary)]
)

#v(10pt)
#text(size: 11pt, weight: "bold")[Rincian Potongan]
#v(4pt)
#table(
  columns: (2fr, 1fr),
  stroke: 0.4pt + luma(180),
  inset: 5pt,
  align: (x, y) => if x == 0 { left + horizon } else { right + horizon },
  text(weight: "bold")[Komponen],
  text(weight: "bold")[Jumlah],
  [BPJS Kesehatan], [#idr(bpjs-kesehatan)],
  [BPJS Ketenagakerjaan], [#idr(bpjs-ketenagakerjaan)],
  [PPh21], [#idr(pph21)],
  [Total Potongan], [#idr(total-deductions)]
)

#v(12pt)
#align(right)[
  #box(stroke: 0.7pt + luma(120), inset: 8pt)[
    #grid(
      columns: (1fr, auto),
      column-gutter: 20pt,
      text(weight: "bold", size: 12pt)[Take Home Pay],
      text(weight: "bold", size: 12pt)[#idr(net-salary)]
    )
  ]
]
