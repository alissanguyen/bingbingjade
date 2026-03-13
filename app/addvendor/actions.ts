"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { VendorPlatform } from "@/types/vendor";

export async function createVendor(formData: FormData): Promise<{ error?: string; success?: boolean; id?: string }> {
  const { data, error } = await supabaseAdmin
    .from("vendors")
    .insert({
      name: formData.get("name") as string,
      platform: formData.get("platform") as VendorPlatform,
      contact: (formData.get("contact") as string) || null,
      notes: (formData.get("notes") as string) || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { success: true, id: data.id };
}
