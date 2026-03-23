import { AdminBar } from "@/app/components/AdminBar";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { VendorsClient } from "./VendorsClient";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const { data: vendors } = await supabaseAdmin
    .from("vendors")
    .select("id, name, platform, contact, notes")
    .order("name");

  return (
    <>
      <AdminBar />
      <VendorsClient vendors={vendors ?? []} />
    </>
  );
}
