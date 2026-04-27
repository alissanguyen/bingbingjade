import { notFound } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { ItemOriginLookupClient } from "./ItemOriginLookupClient";

export const dynamic = "force-dynamic";

export default async function ItemOriginLookupPage() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) notFound();

  return (
    <>
      <AdminBarServer />
      <ItemOriginLookupClient />
    </>
  );
}
