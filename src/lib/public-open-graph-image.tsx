import { ImageResponse } from "next/og";
import { publicBrand, type PublicLocale } from "@/config/public-site";
import { getPublicContent } from "@/content/public-site";

export const publicOpenGraphSize = { width: 1200, height: 630 };

export function createPublicOpenGraphImage(locale: PublicLocale) {
  const content = getPublicContent(locale);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#fff8e8",
          color: "#091d3e",
          padding: "72px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "430px",
            height: "720px",
            right: "-70px",
            top: "-70px",
            background: "#1645e8",
            transform: "rotate(14deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "420px",
            height: "250px",
            right: "210px",
            bottom: "-80px",
            background: "#f15439",
            transform: "rotate(-11deg)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                display: "flex",
                border: "4px solid #091d3e",
                background: "#ffd52a",
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: "30px",
                fontWeight: 800,
                letterSpacing: "7px",
              }}
            >
              {publicBrand.name}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", width: "850px" }}>
            <div
              style={{
                display: "flex",
                fontSize: "20px",
                letterSpacing: "4px",
                textTransform: "uppercase",
                color: "#0b2ca8",
                marginBottom: "22px",
              }}
            >
              {content.common.brand.descriptor} · Sofia
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "64px",
                lineHeight: 1.03,
                letterSpacing: "-3px",
                fontWeight: 800,
              }}
            >
              {content.pages.home.hero.title}
            </div>
          </div>
        </div>
      </div>
    ),
    publicOpenGraphSize,
  );
}
