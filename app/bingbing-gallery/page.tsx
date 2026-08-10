import { supabaseAdmin } from "@/lib/supabase-admin";
import { bingbingGalleryPublicUrl, bingbingGalleryThumbnailUrl } from "@/lib/storage";
import { BingBingGalleryClient } from "./BingBingGalleryClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "BingBing Gallery | BingBing Jade",
  description: "A gallery of BingBing Jade — natural Type A jadeite pieces.",
};

export default async function BingBingGalleryPage() {
  const { data } = await supabaseAdmin
    .from("bingbing_gallery_images")
    .select("id, storage_path")
    .eq("published", true)
    .order("sort_order", { ascending: true });

  const images = (data ?? []).map((row) => ({
    id: row.id as string,
    thumbUrl: bingbingGalleryThumbnailUrl(row.storage_path as string),
    fullUrl: bingbingGalleryPublicUrl(row.storage_path as string),
  }));

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">BingBing Gallery</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Natural Type A jadeite — BingBing Jade</p>
        </div>
        <BingBingGalleryClient images={images} />
      </div>
    </main>
  );
}
