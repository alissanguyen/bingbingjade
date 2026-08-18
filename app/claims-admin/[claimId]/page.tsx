import { AdminBarServer } from "@/app/components/AdminBarServer";
import { ClaimDetailAdminClient } from "./ClaimDetailAdminClient";

export const dynamic = "force-dynamic";

export default async function ClaimDetailAdminPage({ params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params;
  return (
    <>
      <AdminBarServer />
      <ClaimDetailAdminClient claimId={claimId} />
    </>
  );
}
