import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1116",
          color: "#22d3ee",
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        CL
      </div>
    ),
    {
      ...size,
    }
  );
}
