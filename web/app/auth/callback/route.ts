import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/auth/allowlist";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const errorParam = searchParams.get("error");

  const allCookies = (await cookies()).getAll();
  const sbCookies = allCookies
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => c.name);
  console.log("[auth/callback] params:", {
    code: code?.slice(0, 8),
    tokenHash: tokenHash?.slice(0, 8),
    type,
    error: errorParam,
    sb_cookies: sbCookies,
  });

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?error=${errorParam}`);
  }

  const supa = await createClient();

  // Token-hash flow (more robust; no PKCE verifier required)
  if (tokenHash && type) {
    const { data, error } = await supa.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as
        | "email"
        | "magiclink"
        | "recovery"
        | "invite"
        | "email_change",
    });
    if (error || !data.session?.user?.email) {
      console.error("[auth/callback] verifyOtp failed:", error?.message);
      return NextResponse.redirect(
        `${origin}/login?error=verify_failed&detail=${encodeURIComponent(error?.message ?? "no_session")}`,
      );
    }
    if (!isAllowed(data.session.user.email)) {
      await supa.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=not_allowed`);
    }
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // PKCE code flow (default for signInWithOtp + emailRedirectTo)
  if (code) {
    const { data, error } = await supa.auth.exchangeCodeForSession(code);
    if (error || !data.session?.user?.email) {
      console.error("[auth/callback] exchange failed:", error?.message);
      return NextResponse.redirect(
        `${origin}/login?error=exchange_failed&detail=${encodeURIComponent(error?.message ?? "no_session")}`,
      );
    }
    if (!isAllowed(data.session.user.email)) {
      await supa.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=not_allowed`);
    }
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
