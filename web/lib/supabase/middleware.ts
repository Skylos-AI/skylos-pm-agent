import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs on every matched request (see web/middleware.ts config). Its ONLY
// job is to touch supa.auth.getUser() so @supabase/ssr will refresh the
// access token cookies when they are close to expiry. Without this the
// session dies at the access-token TTL (default 1h) and the app kicks
// the user back to /login mid-workday. Refresh tokens outlive it, so as
// long as this runs periodically the session survives ~indefinitely
// (until the refresh token itself expires — set in Supabase dashboard).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supa = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not remove this call — it's the whole reason this middleware exists.
  await supa.auth.getUser();

  return response;
}
