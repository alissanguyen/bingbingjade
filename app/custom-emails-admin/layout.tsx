import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { AdminBarServer } from "@/app/components/AdminBarServer";

export const dynamic = "force-dynamic";

export default async function CustomEmailsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/admin-login");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminBarServer />
      {children}
    </div>
  );
}
