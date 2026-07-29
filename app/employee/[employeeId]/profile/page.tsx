export const dynamic = "force-dynamic";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { ProfileEditForm } from "./ProfileEditForm";

type ProfileRow = {
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  start_date: string;
  status: "active" | "suspended" | "terminated";
};

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;

  const [{ data: profile }, { data: user }] = await Promise.all([
    supabaseAdmin
      .from("employee_profiles")
      .select("display_name, bio, avatar_url, start_date, status")
      .eq("user_id", employeeId)
      .single<ProfileRow>(),
    supabaseAdmin.from("approved_users").select("email").eq("id", employeeId).single<{ email: string }>(),
  ]);

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">Profile</h1>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Name</p>
          <p className="text-sm text-gray-900 dark:text-gray-100">{profile?.display_name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Work Email</p>
          <p className="text-sm text-gray-900 dark:text-gray-100">{user?.email}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Start Date</p>
          <p className="text-sm text-gray-900 dark:text-gray-100">
            {profile?.start_date ? new Date(profile.start_date).toLocaleDateString() : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Account Status</p>
          <p className="text-sm text-gray-900 dark:text-gray-100 capitalize">{profile?.status}</p>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
          Name, start date, and account status are managed by an admin. You can update your bio and photo below.
        </p>
      </div>

      <ProfileEditForm initialBio={profile?.bio ?? ""} initialAvatarUrl={profile?.avatar_url ?? ""} />
    </div>
  );
}
