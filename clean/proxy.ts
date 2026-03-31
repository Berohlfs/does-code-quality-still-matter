import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_API_PATHS = ["/api/auth/signin", "/api/auth/signup"];
const AUTH_PAGES = ["/sign-in", "/sign-up"];

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

async function verifyAuthToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api");
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  // Public API routes (signin/signup) — pass through
  if (PUBLIC_API_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("auth-token")?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  // Authenticated user visiting login → redirect to home
  if (isAuthPage && payload) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Unauthenticated user visiting a protected page → redirect to login
  if (!isApiRoute && !isAuthPage && !payload) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Unauthenticated API request → 401 JSON
  if (isApiRoute && !payload) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Authenticated request — inject user headers for API routes
  if (payload) {
    const headers = new Headers(request.headers);
    headers.set("x-user-id", String(payload.id));
    headers.set("x-user-email", String(payload.email));
    headers.set("x-user-name", String(payload.name));
    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and Next.js internals:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
