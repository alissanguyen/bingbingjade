export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { ServiceRequestsListClient } from "./ServiceRequestsListClient";

export default async function ServiceRequestsAdminPage() {
  const session = await getSessionUser();
  if (!isAdmin(session)) redirect("/admin-login");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <AdminBarServer />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Service Requests</h1>
        <ServiceRequestsListClient />
      </div>
    </div>
  );
}
