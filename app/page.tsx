import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-24 text-center bg-white dark:bg-gray-950">
      <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
        Welcome to <span className="text-emerald-700">BingBing Jade</span>
      </h1>
      <p className="mt-6 text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
        Discover our curated collection of authentic jade jewelry and ornaments, handcrafted for beauty and meaning.
      </p>
      <div className="mt-10 flex justify-center gap-4">
        <Link
          href="/products"
          className="rounded-full bg-emerald-700 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-800 transition-colors"
        >
          Shop Now
        </Link>
        <Link
          href="/contact"
          className="rounded-full border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Contact Us
        </Link>
      </div>
    </div>
  );
}
