import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const isAuth = Boolean(request.cookies.get("opti-activity")?.value);
  const path = request.nextUrl.pathname;

  // Allow static assets, api routes, and icons
  if (
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    path.startsWith("/fonts") ||
    path.startsWith("/icons") ||
    path.startsWith("/uploads") ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // If not logged in and not on /login, redirect to /login
  if (!isAuth && path !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If already logged in and visiting /login, redirect to /
  if (isAuth && path === "/login") {
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
