import { getSessionUser, isAdmin, isApproved } from "@/lib/approved-auth";
import { AdminBar } from "./AdminBar";

export async function AdminBarServer() {
  const session = await getSessionUser();
  return (
    <AdminBar
      showUsersLink={isAdmin(session)}
      isApprovedUser={isApproved(session)}
    />
  );
}
