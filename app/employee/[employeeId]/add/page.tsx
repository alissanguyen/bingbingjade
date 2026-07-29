export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getEmployeeCanViewVendors } from "@/lib/employee-permissions";
import { ProductForm } from "@/app/add/ProductForm";
import { saveEmployeeDraft, submitEmployeeListing } from "@/app/employee/actions";

export default async function EmployeeAddListingPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const canViewVendors = await getEmployeeCanViewVendors(employeeId);
  const { data: vendors } = canViewVendors
    ? await supabaseAdmin.from("vendors").select("*").order("name")
    : { data: [] };

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Add Listing</h1>
      <ProductForm
        mode="employee-create"
        vendors={vendors ?? []}
        canViewVendors={canViewVendors}
        sku=""
        onEmployeeSubmit={submitEmployeeListing}
        onEmployeeSaveDraft={saveEmployeeDraft}
      />
    </div>
  );
}
