import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isAllowed } from "@/lib/auth/allowlist";

// Dev-only quick login. Mints a session via the admin API so you can skip
// the email rate-limit while testing locally. Disabled in production.
//
// Usage: http://localhost:3000/dev/login?email=jhonny.r.lopz@gmail.com

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Disabled in production.", { status: 403 });
  }

  const { searchParams, origin } = new URL(request.url);
  const email = searchParams.get("email")?.toLowerCase().trim();

  if (!email) {
    return new NextResponse(
      "Missing ?email=<addr> query param.",
      { status: 400 },
    );
  }
  if (!isAllowed(email)) {
    return new NextResponse(
      `Email ${email} is not in SKYLOS_TEAM_ALLOWLIST.`,
      { status: 403 },
    );
  }

  // Generate a magic-link token via the admin API. This does NOT send an email.
  const admin = createServiceRoleClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data?.properties?.hashed_token) {
    console.error("[dev/login] generateLink failed:", error?.message);
    return new NextResponse(
      `generateLink failed: ${error?.message ?? "no hashed_token"}`,
      { status: 500 },
    );
  }

  // Exchange the token_hash for a session, setting the auth cookies on the response.
  const supa = await createClient();
  const { data: verifyData, error: verifyError } = await supa.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError || !verifyData.session?.user?.email) {
    console.error("[dev/login] verifyOtp failed:", verifyError?.message);
    return new NextResponse(
      `verifyOtp failed: ${verifyError?.message ?? "no session"}`,
      { status: 500 },
    );
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
