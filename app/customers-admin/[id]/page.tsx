import { AdminBarServer } from "@/app/components/AdminBarServer";
import { CustomerDetailClient } from "./CustomerDetailClient";

export const dynamic = "force-dynamic";

export default function CustomerDetailPage() {
  return (
    <>
      <AdminBarServer />
      <CustomerDetailClient />
    </>
  );
}
