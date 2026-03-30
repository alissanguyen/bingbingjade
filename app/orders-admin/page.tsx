import { AdminBarServer } from "@/app/components/AdminBarServer";
import { OrdersAdminClient } from "./OrdersAdminClient";

export const metadata = { title: "Orders — Admin" };
export const dynamic = "force-dynamic";

export default function OrdersAdminPage() {
  return (
    <>
      <AdminBarServer />
      <OrdersAdminClient />
    </>
  );
}
