import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_API_PATHS = ["/api/auth/signin", "/api/auth/signup"];

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

function isAuthPage(pathname: string) {
  return /^\/(pt-BR|es)?\/?sign-(in|up)(\/.*)?$/.test(pathname);
}

function getLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return `/${locale}`;
    }
  }
  return "";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api");

  // API routes skip i18n entirely
  if (isApiRoute) {
    if (PUBLIC_API_PATHS.includes(pathname)) {
      return NextResponse.next();
    }

    const token = request.cookies.get("auth-token")?.value;
    const payload = token ? await verifyAuthToken(token) : null;

    if (!payload) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const headers = new Headers(request.headers);
    headers.set("x-user-id", String(payload.id));
    headers.set("x-user-email", String(payload.email));
    headers.set("x-user-name", String(payload.name));
    return NextResponse.next({ request: { headers } });
  }

  // Auth check for non-API routes
  const authPage = isAuthPage(pathname);
  const token = request.cookies.get("auth-token")?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  const prefix = getLocalePrefix(pathname);

  // Authenticated user visiting login → redirect to home
  if (authPage && payload) {
    return NextResponse.redirect(new URL(`${prefix}/`, request.url));
  }

  // Unauthenticated user visiting a protected page → redirect to login
  if (!authPage && !payload) {
    return NextResponse.redirect(new URL(`${prefix}/sign-in`, request.url));
  }

  // Run i18n middleware for locale negotiation and rewrites
  const response = intlMiddleware(request);

  // Inject user headers for authenticated requests
  if (payload) {
    response.headers.set("x-user-id", String(payload.id));
    response.headers.set("x-user-email", String(payload.email));
    response.headers.set("x-user-name", String(payload.name));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
