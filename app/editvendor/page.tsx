import { supabaseAdmin } from "@/lib/supabase-admin";
import { VendorList } from "./VendorList";
import { AdminBarServer } from "@/app/components/AdminBarServer";

export default async function EditVendorPage() {
  const { data: vendors } = await supabaseAdmin
    .from("vendors")
    .select("*")
    .order("name");

  return (
    <>
      <AdminBarServer />
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit Vendors</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update supplier contact and platform info.</p>
        </div>
        <VendorList vendors={vendors ?? []} />
      </div>
    </>
  );
}
