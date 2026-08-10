import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser, isAdmin } from "@/lib/approved-auth";
import { BingBingGalleryUploader } from "./BingBingGalleryUploader";

export const dynamic = "force-dynamic";

export default async function UploadBingBingGalleryPage() {
  const session = await getSessionUser();
  if (!session || !isAdmin(session)) redirect("/admin-login");

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">BingBing Gallery Upload</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Upload, crop, and place the logo on images for the public BingBing Gallery</p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            ← Admin
          </Link>
        </div>

        <BingBingGalleryUploader />
      </div>
    </main>
  );
}
