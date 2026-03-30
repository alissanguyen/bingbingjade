import { getSessionUser, isAdmin, isApproved } from "@/lib/approved-auth";
import { AdminBar } from "./AdminBar";

export async function AdminBarServer() {
  const session = await getSessionUser();
  const profileHref = isAdmin(session)
    ? "/admin-profile"
    : isApproved(session)
    ? "/profile"
    : undefined;
  return (
    <AdminBar
      showUsersLink={isAdmin(session)}
      profileHref={profileHref}
    />
  );
}
