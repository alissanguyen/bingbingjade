import { LoginForm } from "./LoginForm";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Access</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">BingBing Jade</p>
        </div>
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8">
          <LoginForm redirectTo={from ?? "/add"} />
        </div>
        <p className="mt-4 text-center text-sm text-gray-400 dark:text-gray-500">
          Not an admin?{" "}
          <a href="/approved-login" className="text-emerald-600 dark:text-emerald-400 hover:underline">
            Partner portal login
          </a>
        </p>
      </div>
    </div>
  );
}
