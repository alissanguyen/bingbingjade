export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { ServiceRequestDetailClient } from "./ServiceRequestDetailClient";

export default async function ServiceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/admin-login");
  const { id } = await params;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminBarServer />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        <ServiceRequestDetailClient id={id} />
      </div>
    </div>
  );
}
