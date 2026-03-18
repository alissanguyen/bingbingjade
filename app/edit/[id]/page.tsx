import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveImageUrls, resolveVideoUrls, isStoragePath } from "@/lib/storage";
import { EditForm } from "./EditForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: product }, { data: vendors }] = await Promise.all([
    supabaseAdmin.from("products").select("*").eq("id", id).single(),
    supabaseAdmin.from("vendors").select("*").order("name"),
  ]);

  if (!product) notFound();

  const imagePaths: string[] = product.images ?? [];
  const videoPaths: string[] = product.videos ?? [];

  const [resolvedImages, resolvedVideos] = await Promise.all([
    imagePaths.some(isStoragePath) ? resolveImageUrls(imagePaths) : Promise.resolve(imagePaths),
    videoPaths.some(isStoragePath) ? resolveVideoUrls(videoPaths) : Promise.resolve(videoPaths),
  ]);

  const productWithUrls = {
    ...product,
    images: resolvedImages,
    videos: resolvedVideos,
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8">
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">Editing</p>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{product.name}</h1>
      </div>
      <EditForm product={productWithUrls} vendors={vendors ?? []} />
    </div>
  );
}
