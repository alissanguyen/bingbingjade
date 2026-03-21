"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function bulkUpdateStatus(
  ids: string[],
  status: "available" | "on_sale" | "sold"
): Promise<{ error?: string; count?: number }> {
  if (ids.length === 0) return { count: 0 };

  const { error, count } = await supabaseAdmin
    .from("products")
    .update({ status })
    .in("id", ids);

  if (error) return { error: error.message };

  revalidatePath("/edit");
  revalidatePath("/products");
  return { count: count ?? ids.length };
}

export async function bulkUpdatePublished(
  ids: string[],
  is_published: boolean
): Promise<{ error?: string; count?: number }> {
  if (ids.length === 0) return { count: 0 };

  const { error, count } = await supabaseAdmin
    .from("products")
    .update({ is_published })
    .in("id", ids);

  if (error) return { error: error.message };

  revalidatePath("/edit");
  revalidatePath("/products");
  return { count: count ?? ids.length };
}

export async function bulkDelete(
  ids: string[]
): Promise<{ error?: string; count?: number }> {
  if (ids.length === 0) return { count: 0 };

  const { error, count } = await supabaseAdmin
    .from("products")
    .delete()
    .in("id", ids);

  if (error) return { error: error.message };

  revalidatePath("/edit");
  revalidatePath("/products");
  return { count: count ?? ids.length };
}
