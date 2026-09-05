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
          overflow: "hidden",
          position: "relative",
          background:
            "radial-gradient(220px 220px at 72px 88px, #d7b98d 20%, transparent 64%), radial-gradient(250px 250px at 1028px 582px, #ecdac4 10%, transparent 65%), #f6f1e8",
          color: "#2f2620",
          padding: "72px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              gap: "22px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "58px",
                  height: "58px",
                  borderRadius: "22px",
                  border: "1px solid rgba(47, 38, 32, 0.44)",
                  background: "#d7b98d",
                }}
              />
              <div
                style={{
                  display: "flex",
                  color: "#355b85",
                  fontSize: "31px",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  lineHeight: 1,
                }}
              >
                {publicBrand.name}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: "780px",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "20px",
                  letterSpacing: "0.02em",
                  color: "#4e443c",
                  opacity: 0.95,
                }}
              >
                {content.common.brand.descriptor} · {content.common.brand.location}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "62px",
                  lineHeight: 1.02,
                  letterSpacing: "-2px",
                  fontWeight: 650,
                  width: "780px",
                }}
              >
                {content.pages.home.hero.title}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "space-between",
              color: "#4e443c",
              fontSize: "19px",
              letterSpacing: "0.01em",
              marginTop: "28px",
            }}
          >
            <div style={{ display: "flex" }}>{publicBrand.location.city}</div>
            <div style={{ display: "flex" }}>{content.pages.home.hero.primaryAction}</div>
          </div>
        </div>
      </div>
    ),
    publicOpenGraphSize,
  );
}
