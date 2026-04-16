import { ImageResponse } from "next/og"

export const runtime = "nodejs"

export const alt = "Integra — Satu sistem. Semua kendali."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const BLUE = "#2040FF"
const OBSIDIAN = "#0D0D0B"
const PAPER = "#FAF9F6"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          fontFamily: "Geist, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background grid quadrants (top-right, subtle) */}
        <div
          style={{
            position: "absolute",
            top: "60px",
            right: "0px",
            display: "flex",
            flexWrap: "wrap",
            width: "500px",
            gap: "20px",
          }}
        >
          <div style={{ width: "240px", height: "240px", borderRadius: "44px", background: BLUE, opacity: 0.06, display: "flex" }} />
          <div style={{ width: "240px", height: "240px", borderRadius: "44px", background: OBSIDIAN, opacity: 0.03, display: "flex" }} />
          <div style={{ width: "240px", height: "240px", borderRadius: "44px", background: OBSIDIAN, opacity: 0.03, display: "flex" }} />
          <div style={{ width: "240px", height: "240px", borderRadius: "44px", background: BLUE, opacity: 0.04, display: "flex" }} />
        </div>

        {/* Top: Logo mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px", padding: "60px 0 0 64px" }}>
          {/* Grid icon */}
          <div style={{ display: "flex", flexWrap: "wrap", width: "76px", gap: "6px" }}>
            <div style={{ width: "35px", height: "35px", borderRadius: "7px", background: BLUE, display: "flex" }} />
            <div style={{ width: "35px", height: "35px", borderRadius: "7px", background: OBSIDIAN, opacity: 0.12, display: "flex" }} />
            <div style={{ width: "35px", height: "35px", borderRadius: "7px", background: OBSIDIAN, opacity: 0.12, display: "flex" }} />
            <div style={{ width: "35px", height: "35px", borderRadius: "7px", background: BLUE, opacity: 0.45, display: "flex" }} />
          </div>
          <div
            style={{
              fontSize: "52px",
              fontWeight: 700,
              color: OBSIDIAN,
              letterSpacing: "-2px",
              display: "flex",
            }}
          >
            Integra.
          </div>
        </div>

        {/* Main tagline */}
        <div style={{ display: "flex", flexDirection: "column", padding: "60px 0 0 64px", flex: 1 }}>
          <div
            style={{
              fontSize: "96px",
              fontWeight: 900,
              color: OBSIDIAN,
              letterSpacing: "-5px",
              lineHeight: 1.15,
              display: "flex",
            }}
          >
            Satu sistem.
          </div>
          <div
            style={{
              fontSize: "96px",
              fontWeight: 900,
              color: "#888884",
              letterSpacing: "-5px",
              lineHeight: 1.15,
              display: "flex",
            }}
          >
            Semua kendali.
          </div>
          <div
            style={{
              fontSize: "26px",
              fontWeight: 400,
              color: "#BBBBBB",
              marginTop: "28px",
              display: "flex",
            }}
          >
            Dibuat untuk pemilik usaha. Bukan departemen IT.
          </div>
        </div>

        {/* Blue dot bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            right: "40px",
            width: "20px",
            height: "20px",
            borderRadius: "10px",
            background: BLUE,
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  )
}
