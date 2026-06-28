import { redirect, notFound } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { LiveModeClient } from "./LiveModeClient";

export const dynamic = "force-dynamic";

export default async function LiveModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) redirect("/admin-login");

  const { id } = await params;

  const [{ data: ls }, { data: items }] = await Promise.all([
    supabaseAdmin.from("livestreams").select("*").eq("id", id).maybeSingle(),
    supabaseAdmin
      .from("livestream_items")
      .select("*, product:products(id, name, status)")
      .eq("livestream_id", id)
      .order("display_order"),
  ]);

  if (!ls) notFound();

  return <LiveModeClient livestream={ls} initialItems={items ?? []} />;
}
