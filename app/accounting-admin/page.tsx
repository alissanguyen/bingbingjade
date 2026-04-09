import { AdminBarServer } from "@/app/components/AdminBarServer";
import { AccountingClient } from "./AccountingClient";

export const metadata = { title: "Accounting — Admin" };
export const dynamic = "force-dynamic";

export default function AccountingAdminPage() {
  return (
    <>
      <AdminBarServer />
      <AccountingClient />
    </>
  );
}
