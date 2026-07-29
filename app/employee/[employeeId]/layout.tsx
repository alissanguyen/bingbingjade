export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { getSessionUser, isAdmin, isCatalogContributor } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { EmployeeNav } from "@/app/employee/EmployeeNav";

export default async function EmployeeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const session = await getSessionUser();

  if (!session) redirect("/approved-login");

  // The one and only ownership check that matters: a catalog contributor
  // may only ever be inside their own employeeId subtree. Admin is the sole
  // exception (spec: "The master admin is the only exception").
  const authorized = isAdmin(session) || (isCatalogContributor(session) && session.user.id === employeeId);
  if (!authorized) {
    redirect("/approved-login");
  }

  const { data: profile } = await supabaseAdmin
    .from("employee_profiles")
    .select("display_name")
    .eq("user_id", employeeId)
    .maybeSingle();

  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <EmployeeNav employeeId={employeeId} displayName={profile.display_name} />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">{children}</div>
    </div>
  );
}
