import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getAssetsList } from "@/lib/data/assets";
import { AssetsTable, AddAssetButton } from "@/components/pm/assets-table";
import { t } from "@/lib/i18n/es";

export default async function AssetsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const assets = await getAssetsList();

  return (
    <div className="min-h-screen p-8 lg:p-10 space-y-6 max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="font-display text-5xl tracking-tight leading-tight">
            {t.assets.title}
          </h1>
          <p className="text-sm text-[var(--brand-fg-muted)] max-w-2xl">
            {t.assets.subtitle}
          </p>
        </div>
        <AddAssetButton />
      </header>

      <AssetsTable assets={assets} />
    </div>
  );
}
