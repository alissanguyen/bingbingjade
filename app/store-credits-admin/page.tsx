import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { StoreCreditsAdminClient } from "./StoreCreditsAdminClient";

export const dynamic = "force-dynamic";

export default async function StoreCreditsAdminPage() {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/admin-login");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminBarServer />
      <StoreCreditsAdminClient />
    </div>
  );
}
