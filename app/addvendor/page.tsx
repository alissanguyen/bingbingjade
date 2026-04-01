import { VendorForm } from "./VendorForm";
import { AdminBarServer } from "@/app/components/AdminBarServer";

export default function AddVendorPage() {
  return (
    <>
      <AdminBarServer />
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Add Vendor</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Save a supplier&apos;s contact and platform info for future reference.
          </p>
        </div>
        <VendorForm />
      </div>
    </>
  );
}
