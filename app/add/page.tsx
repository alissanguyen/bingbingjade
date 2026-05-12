export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { ProductForm } from "./ProductForm";
import { AdminBarServer } from "@/app/components/AdminBarServer";
import { getSessionUser, isApproved } from "@/lib/approved-auth";

function generateSku(): string {
  return String(Math.floor(Math.random() * 100_000_000)).padStart(8, "0");
}

export default async function AddProductPage() {
  const [{ data: vendors }, session] = await Promise.all([
    supabaseAdmin.from("vendors").select("*").order("name"),
    getSessionUser(),
  ]);

  const approvedUser = isApproved(session);

  return (
    <>
    <AdminBarServer />
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Add Product</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Fill in the details below to list a new jade piece.</p>
      </div>
      <ProductForm vendors={approvedUser ? [] : (vendors ?? [])} isApprovedUser={approvedUser} sku={generateSku()} />
    </div>
    </>
  );
}
