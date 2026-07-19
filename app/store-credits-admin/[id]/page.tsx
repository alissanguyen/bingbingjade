import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { StoreCreditDetailClient } from "./StoreCreditDetailClient";

export const dynamic = "force-dynamic";

export default async function StoreCreditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/admin-login");

  const { id } = await params;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminBarServer />
      <StoreCreditDetailClient id={id} />
    </div>
  );
}
