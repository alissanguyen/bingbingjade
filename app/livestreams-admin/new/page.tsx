import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { NewLivestreamForm } from "./NewLivestreamForm";

export const metadata = { title: "New Livestream — Admin" };
export const dynamic = "force-dynamic";

export default async function NewLivestreamPage() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) redirect("/admin-login");

  return (
    <>
      <AdminBarServer />
      <NewLivestreamForm />
    </>
  );
}
