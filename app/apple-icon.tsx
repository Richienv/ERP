import { ImageResponse } from "next/og"
import { INTEGRA_COLORS, INTEGRA_MARK } from "@/components/brand/integra-logo"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

// The Integra mark scaled from its 32 x 32 grid. Full-bleed square: iOS rounds the corners itself.
const SCALE = size.width / INTEGRA_MARK.size

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: INTEGRA_COLORS.blue,
          display: "flex",
          position: "relative",
        }}
      >
        {INTEGRA_MARK.bars.map((bar) => (
          <div
            key={bar.y}
            style={{
              position: "absolute",
              left: `${Math.round(bar.x * SCALE)}px`,
              top: `${Math.round(bar.y * SCALE)}px`,
              width: `${Math.round(bar.width * SCALE)}px`,
              height: `${Math.round(INTEGRA_MARK.barHeight * SCALE)}px`,
              borderRadius: `${Math.round(INTEGRA_MARK.barRadius * SCALE)}px`,
              background: INTEGRA_COLORS.white,
              display: "flex",
            }}
          />
        ))}
      </div>
    ),
    { ...size }
  )
}
