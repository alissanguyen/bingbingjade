import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveImageUrls, resolveVideoUrls, isStoragePath } from "@/lib/storage";
import { EditForm } from "./EditForm";
import { getSessionUser, isApproved } from "@/lib/approved-auth";
import type { OptionStatus } from "@/types/product";

interface InitialOptionRaw {
  id: string;
  label: string | null;
  size: number | null;
  price_usd: number | null;
  sale_price_usd: number | null;
  status: OptionStatus;
  images: string[];
}

interface InitialOption extends InitialOptionRaw {
  imageUrls: string[]; // resolved for display
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [{ data: product }, { data: vendors }, { data: optionsData }, session] = await Promise.all([
    supabaseAdmin.from("products").select("*").eq("id", id).single(),
    supabaseAdmin.from("vendors").select("*").order("name"),
    supabaseAdmin
      .from("product_options")
      .select("id, label, size, price_usd, sale_price_usd, status, images")
      .eq("product_id", id)
      .order("sort_order")
      .returns<InitialOptionRaw[]>(),
    getSessionUser(),
  ]);

  if (!product) notFound();

  const imagePaths: string[] = product.images ?? [];
  const videoPaths: string[] = product.videos ?? [];

  const [resolvedImages, resolvedVideos] = await Promise.all([
    imagePaths.some(isStoragePath) ? resolveImageUrls(imagePaths) : Promise.resolve(imagePaths),
    videoPaths.some(isStoragePath) ? resolveVideoUrls(videoPaths) : Promise.resolve(videoPaths),
  ]);

  // Resolve option images for display in the edit form
  const initialOptions: InitialOption[] = await Promise.all(
    (optionsData ?? []).map(async (opt) => {
      const paths = opt.images ?? [];
      const urls = paths.some(isStoragePath) ? await resolveImageUrls(paths) : paths;
      return { ...opt, imageUrls: urls };
    })
  );

  const productWithUrls = {
    ...product,
    images: resolvedImages,
    videos: resolvedVideos,
    // Strip profit margin data from approved user sessions — never serialized to client props
    ...(isApproved(session) ? { imported_price_vnd: 0 } : {}),
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8">
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-1">Editing</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{product.name}</h1>
      </div>
      <EditForm
        product={productWithUrls}
        vendors={vendors ?? []}
        initialOptions={initialOptions}
        isApprovedUser={isApproved(session)}
        hasPendingApproval={product.pending_approval ?? false}
      />
    </div>
  );
}
