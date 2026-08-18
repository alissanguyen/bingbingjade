import ClaimStatusView from "./ClaimStatusView";

export default async function ClaimStatusPage({ params }: { params: Promise<{ orderNumber: string; claimId: string }> }) {
  const { orderNumber, claimId } = await params;
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <ClaimStatusView orderNumber={orderNumber} claimId={claimId} />
    </div>
  );
}
