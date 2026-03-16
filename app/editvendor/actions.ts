"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { VendorPlatform } from "@/types/vendor";

export async function updateVendor(
  id: string,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const { error } = await supabaseAdmin
    .from("vendors")
    .update({
      name: formData.get("name") as string,
      platform: formData.get("platform") as VendorPlatform,
      contact: (formData.get("contact") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}
