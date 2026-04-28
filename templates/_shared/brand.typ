// templates/_shared/brand.typ
// Shared brand module — read inputs once, expose helpers for all templates.

#let brand-inputs = (
  company_name: sys.inputs.at("company_name", default: "Perusahaan Anda"),
  company_address: sys.inputs.at("company_address", default: ""),
  company_npwp: sys.inputs.at("company_npwp", default: ""),
  company_email: sys.inputs.at("company_email", default: ""),
  company_phone: sys.inputs.at("company_phone", default: ""),
  logo_path: sys.inputs.at("logo_path", default: ""),
  brand_color: sys.inputs.at("brand_color", default: "#18181b"),
)

#let brand-color = rgb(brand-inputs.brand_color)
#let brand-text-color = rgb("#27272a")
#let brand-muted = rgb("#71717a")

#let header() = {
  block(
    width: 100%,
    inset: (bottom: 12pt),
    stroke: (bottom: 1.5pt + brand-color),
    grid(
      columns: (1fr, auto),
      align: (left + horizon, right + horizon),
      gutter: 12pt,
      [
        #if brand-inputs.logo_path != "" [
          #image(brand-inputs.logo_path, height: 32pt)
        ] else [
          #text(weight: "bold", size: 14pt, fill: brand-color)[#brand-inputs.company_name]
        ]
      ],
      [
        #text(weight: "bold", size: 11pt)[#brand-inputs.company_name] \
        #if brand-inputs.company_address != "" [
          #text(size: 8pt, fill: brand-muted)[#brand-inputs.company_address] \
        ]
        #if brand-inputs.company_npwp != "" [
          #text(size: 8pt, fill: brand-muted)[NPWP: #brand-inputs.company_npwp]
        ]
      ],
    ),
  )
}

#let footer() = {
  align(center)[
    #text(size: 7pt, fill: brand-muted)[
      #brand-inputs.company_name
      #if brand-inputs.company_email != "" [• #brand-inputs.company_email]
      #if brand-inputs.company_phone != "" [• #brand-inputs.company_phone]
    ]
  ]
}
