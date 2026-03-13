import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase";

// Server-only — never import this in client components
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
