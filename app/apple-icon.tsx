import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#2040FF",
          borderRadius: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "8px",
          padding: "36px",
        }}
      >
        <div style={{ width: "46px", height: "46px", borderRadius: "10px", background: "white", display: "flex" }} />
        <div style={{ width: "46px", height: "46px", borderRadius: "10px", background: "rgba(255,255,255,0.30)", display: "flex" }} />
        <div style={{ width: "46px", height: "46px", borderRadius: "10px", background: "rgba(255,255,255,0.30)", display: "flex" }} />
        <div style={{ width: "46px", height: "46px", borderRadius: "10px", background: "rgba(255,255,255,0.65)", display: "flex" }} />
      </div>
    ),
    { ...size }
  )
}
