import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth-security";

const PUBLIC_PATHS = [
  "/login",
  "/offline.html",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/api/login",
  "/api/health",
  "/health",
];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Static assets are always allowed
  if (
    path.startsWith("/_next") ||
    path.startsWith("/fonts") ||
    path.startsWith("/icons") ||
    path.startsWith("/uploads") ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("opti-activity")?.value;
  const session = verifySessionToken(token, 8 * 60);
  const isAuthenticated = session.valid;

  // Handle API routes
  if (path.startsWith("/api")) {
    if (PUBLIC_PATHS.includes(path)) {
      return NextResponse.next();
    }
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.next();
  }

  // Handle page routes
  if (!isAuthenticated && !PUBLIC_PATHS.includes(path)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthenticated && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const result = NextResponse.next();
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|icons/|sw.js|manifest.webmanifest).*)",
  ],
};
