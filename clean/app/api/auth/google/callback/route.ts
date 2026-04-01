import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schemas";
import { signToken, setAuthCookie } from "@/app/api/auth/_helpers/jwt";

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  name: string;
  email: string;
  email_verified: boolean;
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to exchange authorization code");
  }

  return response.json();
}

async function getGoogleUser(
  accessToken: string
): Promise<GoogleUserInfo> {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Google user info");
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/sign-in?error=google_auth_failed`);
  }

  try {
    const redirectUri = `${appUrl}/api/auth/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const googleUser = await getGoogleUser(tokens.access_token);

    if (!googleUser.email_verified) {
      return NextResponse.redirect(
        `${appUrl}/sign-in?error=email_not_verified`
      );
    }

    const normalizedEmail = googleUser.email.toLowerCase();

    // Check if user exists by Google ID or email
    let existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.googleId, googleUser.sub))
      .limit(1);

    if (existingUsers.length === 0) {
      existingUsers = await db
        .select()
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);
    }

    let user;

    if (existingUsers.length > 0) {
      user = existingUsers[0];

      // Link Google ID if not already linked
      if (!user.googleId) {
        await db
          .update(users)
          .set({ googleId: googleUser.sub })
          .where(eq(users.id, user.id));
      }
    } else {
      // Create new user
      const id = Date.now();
      await db.insert(users).values({
        id,
        name: googleUser.name,
        email: normalizedEmail,
        googleId: googleUser.sub,
      });
      user = { id, name: googleUser.name, email: normalizedEmail };
    }

    const token = await signToken({
      id: user.id,
      name: user.name,
      email: user.email,
    });
    await setAuthCookie(token);

    return NextResponse.redirect(appUrl);
  } catch {
    return NextResponse.redirect(`${appUrl}/sign-in?error=google_auth_failed`);
  }
}
