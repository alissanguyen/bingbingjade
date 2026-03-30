import { AdminBarServer } from "@/app/components/AdminBarServer";
import { CustomersAdminClient } from "./CustomersAdminClient";

export const dynamic = "force-dynamic";

export default function CustomersAdminPage() {
  return (
    <>
      <AdminBarServer />
      <CustomersAdminClient />
    </>
  );
}
