import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { AdminBar } from "./AdminBar";

export async function AdminBarServer() {
  const session = await getSessionUser();
  return <AdminBar showUsersLink={isAdmin(session)} />;
}
