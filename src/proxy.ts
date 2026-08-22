import { NextResponse, type NextRequest } from "next/server";
import { getNeonAuthClient } from "@/auth/neon-provider";

export default async function proxy(request: NextRequest) {
  try {
    return await getNeonAuthClient().middleware({ loginUrl: "/login" })(request);
  } catch {
    return NextResponse.redirect(new URL("/login?auth=unavailable", request.url));
  }
}

export const config = {
  matcher: ["/app/:path*"],
};
