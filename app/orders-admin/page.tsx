import { AdminBar } from "@/app/components/AdminBar";
import { OrdersAdminClient } from "./OrdersAdminClient";

export const metadata = { title: "Orders — Admin" };
export const dynamic = "force-dynamic";

export default function OrdersAdminPage() {
  return (
    <>
      <AdminBar />
      <OrdersAdminClient />
    </>
  );
}
