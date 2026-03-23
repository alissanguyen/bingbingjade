"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { VendorPlatform } from "@/types/vendor";

export async function createVendor(
  formData: FormData
): Promise<{ error?: string; success?: boolean; id?: string }> {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name is required." };

  const { data, error } = await supabaseAdmin
    .from("vendors")
    .insert({
      name,
      platform: formData.get("platform") as VendorPlatform,
      contact: (formData.get("contact") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { success: true, id: data.id };
}

export async function updateVendor(
  id: string,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Name is required." };

  const { error } = await supabaseAdmin
    .from("vendors")
    .update({
      name,
      platform: formData.get("platform") as VendorPlatform,
      contact: (formData.get("contact") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteVendors(
  ids: string[]
): Promise<{ error?: string; deleted?: number }> {
  if (!ids.length) return { deleted: 0 };

  const { error, count } = await supabaseAdmin
    .from("vendors")
    .delete({ count: "exact" })
    .in("id", ids);

  if (error) return { error: error.message };
  return { deleted: count ?? ids.length };
}
