import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/es";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supa = await createClient();
  const { data } = await supa.auth.getUser();

  if (!data.user) {
    redirect("/forgot-password?expired=1");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-[0.06] brand-gradient"
        aria-hidden
      />
      <div className="absolute -top-20 -right-20 w-[480px] h-[480px] -z-10 opacity-70 pointer-events-none">
        <Image
          src="/crystals/crystal-octahedron-blue.png"
          alt=""
          fill
          sizes="480px"
          priority
          style={{ objectFit: "contain" }}
        />
      </div>
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] -z-10 opacity-60 pointer-events-none">
        <Image
          src="/crystals/crystal-prism-blue.png"
          alt=""
          fill
          sizes="420px"
          style={{ objectFit: "contain" }}
        />
      </div>

      <div className="w-full max-w-md bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-10 [box-shadow:var(--shadow-card)]">
        <div className="flex items-center gap-3 mb-8">
          <Image
            src="/logo-skylos.svg"
            alt="Skylos"
            width={120}
            height={28}
            style={{ height: "auto" }}
            priority
          />
        </div>
        <h1 className="font-display text-3xl mb-2 tracking-tight">
          {t.resetPassword.title}
        </h1>
        <p className="text-[var(--brand-fg-muted)] text-sm mb-8">
          {t.resetPassword.subtitle}
        </p>

        <ResetPasswordForm />

        <p className="mt-8 text-sm text-[var(--brand-fg-muted)] text-center">
          <Link href="/login" className="text-[var(--brand-blue)] hover:underline font-medium">
            {t.forgotPassword.backToLogin}
          </Link>
        </p>
      </div>
    </div>
  );
}
