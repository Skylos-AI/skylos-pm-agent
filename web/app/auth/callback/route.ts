import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/auth/allowlist";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next");
  const errorParam = searchParams.get("error");

  const allCookies = (await cookies()).getAll();
  const sbCookies = allCookies
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => c.name);
  console.log("[auth/callback] params:", {
    code: code?.slice(0, 8),
    tokenHash: tokenHash?.slice(0, 8),
    type,
    next,
    error: errorParam,
    sb_cookies: sbCookies,
  });

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?error=${errorParam}`);
  }

  const supa = await createClient();

  const finishRedirect = (verifiedType: string | null) => {
    // Password recovery → land on /reset-password so user can set new password.
    if (verifiedType === "recovery" || next === "/reset-password") {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
    // Signup confirmation → bounce back to /login with a success notice.
    // Session cookies were set, but we want the user to sign in explicitly.
    if (verifiedType === "signup") {
      return NextResponse.redirect(`${origin}/login?notice=email_confirmed`);
    }
    return NextResponse.redirect(`${origin}${next || "/dashboard"}`);
  };

  // Token-hash flow (more robust; no PKCE verifier required)
  if (tokenHash && type) {
    const { data, error } = await supa.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as
        | "email"
        | "magiclink"
        | "recovery"
        | "invite"
        | "email_change"
        | "signup",
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
    return finishRedirect(type);
  }

  // PKCE code flow (used by signUp emailRedirectTo and resetPasswordForEmail)
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
    // With PKCE the URL doesn't carry `type`, so infer from `next` (set by
    // forgot-password action). Signup confirmations arrive without `next`
    // and we can't distinguish them from sign-in — default to /dashboard.
    return finishRedirect(next === "/reset-password" ? "recovery" : null);
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
