import { createClient } from "@supabase/supabase-js";
import type { Product } from "@/types/product";
import type { Vendor } from "@/types/vendor";

export type Database = {
  public: {
    Tables: {
      products: {
        Row: Product;
        Insert: Omit<Product, "id" | "created_at">;
        Update: Partial<Omit<Product, "id" | "created_at">>;
      };
      vendors: {
        Row: Vendor;
        Insert: Omit<Vendor, "id">;
        Update: Partial<Omit<Vendor, "id">>;
      };
    };
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
