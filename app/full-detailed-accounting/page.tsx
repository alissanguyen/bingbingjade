import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { AccountingDashboard } from "./AccountingDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Accounting — BingBing Jade Admin",
  robots: "noindex, nofollow",
};

export default async function FullDetailedAccountingPage() {
  const session = await getSessionUser();

  if (!session || !isAdmin(session)) {
    redirect("/admin");
  }

  return (
    <>
      <AdminBarServer />
      <AccountingDashboard />
    </>
  );
}
