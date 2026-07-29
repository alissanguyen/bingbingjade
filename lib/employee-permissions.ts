/**
 * Per-employee capability flags (employee_profiles), beyond the base
 * catalog_contributor role. Kept in its own small module (not part of
 * app/employee/actions.ts, which is a "use server" actions file) so it can
 * be imported freely from both server components and server actions.
 */

import { supabaseAdmin } from "./supabase-admin";

export async function getEmployeeCanViewVendors(employeeId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("employee_profiles")
    .select("can_view_vendors")
    .eq("user_id", employeeId)
    .maybeSingle();
  return data?.can_view_vendors ?? false;
}
