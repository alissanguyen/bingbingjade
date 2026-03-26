import { AdminBar } from "@/app/components/AdminBar";
import { CustomersAdminClient } from "./CustomersAdminClient";

export const dynamic = "force-dynamic";

export default function CustomersAdminPage() {
  return (
    <>
      <AdminBar />
      <CustomersAdminClient />
    </>
  );
}
