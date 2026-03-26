import { AdminBar } from "@/app/components/AdminBar";
import { CustomerDetailClient } from "./CustomerDetailClient";

export const dynamic = "force-dynamic";

export default function CustomerDetailPage() {
  return (
    <>
      <AdminBar />
      <CustomerDetailClient />
    </>
  );
}
