import { ImageResponse } from "next/og"
import { INTEGRA_COLORS, INTEGRA_MARK } from "@/components/brand/integra-logo"

export const runtime = "nodejs"

export const alt = "Integra — Satu sistem. Semua kendali."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const { blue: BLUE, navy: NAVY, ink: INK, canvas: CANVAS, slate: SLATE, white: WHITE } = INTEGRA_COLORS

/** The Integra mark, drawn with divs from the shared 32 x 32 geometry. */
function Mark({ px }: { px: number }) {
  const scale = px / INTEGRA_MARK.size
  return (
    <div
      style={{
        width: `${px}px`,
        height: `${px}px`,
        borderRadius: `${Math.round(INTEGRA_MARK.radius * scale)}px`,
        background: BLUE,
        position: "relative",
        display: "flex",
      }}
    >
      {INTEGRA_MARK.bars.map((bar) => (
        <div
          key={bar.y}
          style={{
            position: "absolute",
            left: `${Math.round(bar.x * scale)}px`,
            top: `${Math.round(bar.y * scale)}px`,
            width: `${Math.round(bar.width * scale)}px`,
            height: `${Math.round(INTEGRA_MARK.barHeight * scale)}px`,
            borderRadius: `${Math.round(INTEGRA_MARK.barRadius * scale)}px`,
            background: WHITE,
            display: "flex",
          }}
        />
      ))}
    </div>
  )
}

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: CANVAS,
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Left: wordmark and promise */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "64px 0 56px 72px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <Mark px={72} />
            <div style={{ fontSize: "56px", fontWeight: 600, color: INK, letterSpacing: "-1.5px", display: "flex" }}>
              integra
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
            <div style={{ fontSize: "84px", fontWeight: 700, color: INK, letterSpacing: "-3px", lineHeight: 1.1, display: "flex" }}>
              Satu sistem.
            </div>
            <div style={{ fontSize: "84px", fontWeight: 700, color: BLUE, letterSpacing: "-3px", lineHeight: 1.1, display: "flex" }}>
              Semua kendali.
            </div>
            <div style={{ fontSize: "28px", fontWeight: 400, color: SLATE, marginTop: "28px", display: "flex" }}>
              Dibuat untuk pemilik usaha. Bukan departemen IT.
            </div>
          </div>
        </div>

        {/* Right: navy panel, like the app's menu, carrying a large mark */}
        <div
          style={{
            width: "340px",
            height: "100%",
            background: NAVY,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Mark px={176} />
        </div>
      </div>
    ),
    { ...size }
  )
}
