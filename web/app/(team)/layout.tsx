import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { isAllowed } from "@/lib/auth/allowlist";
import { NavSidebar } from "@/components/pm/nav-sidebar";

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user || !isAllowed(user.email)) {
    redirect("/login");
  }
  return (
    <div className="min-h-screen flex">
      <NavSidebar userFullName={user.full_name} userEmail={user.email} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
