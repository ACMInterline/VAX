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
          background: "#edf1e8",
          color: "#172e29",
          padding: "72px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "620px",
            height: "620px",
            right: "-120px",
            top: "-160px",
            borderRadius: "50%",
            background: "#c9dcbe",
            opacity: 0.9,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "360px",
            height: "360px",
            right: "100px",
            bottom: "-160px",
            borderRadius: "50%",
            background: "#e2a765",
            opacity: 0.8,
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
                borderRadius: "16px",
                background: "#173f36",
              }}
            />
            <div style={{ display: "flex", fontSize: "30px", fontWeight: 700 }}>
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
                color: "#35665a",
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
                fontWeight: 700,
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
