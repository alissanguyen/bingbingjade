import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { RestrictedCustomersClient } from "./RestrictedCustomersClient";

export const dynamic = "force-dynamic";

export default async function RestrictedCustomersPage() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) redirect("/admin-login");

  return (
    <>
      <AdminBarServer />
      <RestrictedCustomersClient />
    </>
  );
}
