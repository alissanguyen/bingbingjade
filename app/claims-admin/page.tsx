import { AdminBarServer } from "@/app/components/AdminBarServer";
import { ClaimsAdminClient } from "./ClaimsAdminClient";

export const metadata = { title: "Claims — Admin" };
export const dynamic = "force-dynamic";

export default function ClaimsAdminPage() {
  return (
    <>
      <AdminBarServer />
      <ClaimsAdminClient />
    </>
  );
}
