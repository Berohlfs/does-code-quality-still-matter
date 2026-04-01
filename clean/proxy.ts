import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { createHash } from "crypto";
import postgres from "postgres";

const PUBLIC_API_PATHS = ["/api/auth/signin", "/api/auth/signup"];
const AUTH_PAGES = ["/sign-in", "/sign-up"];

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

async function verifyJwt(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function verifyApiToken(
  bearerToken: string
): Promise<{ id: number; email: string; name: string } | null> {
  const tokenHash = hashToken(bearerToken);
  const sql = postgres(process.env.DATABASE_POOL_URL!, { prepare: false });
  try {
    const rows = await sql`
      SELECT u.id, u.email, u.name, t.id AS token_id
      FROM api_tokens t
      JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ${tokenHash}
      LIMIT 1
    `;
    if (rows.length === 0) return null;

    // Update last_used_at in the background (fire-and-forget)
    sql`UPDATE api_tokens SET last_used_at = now() WHERE id = ${rows[0].token_id}`.catch(
      () => {}
    );

    return {
      id: Number(rows[0].id),
      email: rows[0].email,
      name: rows[0].name,
    };
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

  // Try JWT cookie first, then Bearer token for API routes
  const cookieToken = request.cookies.get("auth-token")?.value;
  let payload = cookieToken ? await verifyJwt(cookieToken) : null;

  // If no JWT cookie and this is an API request, check for Bearer token
  if (!payload && isApiRoute) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer tf_")) {
      const bearerToken = authHeader.slice(7);
      payload = await verifyApiToken(bearerToken);
    }
  }

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
