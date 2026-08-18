import NewClaimWizard from "./NewClaimWizard";

export default async function NewClaimPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <NewClaimWizard orderNumber={orderNumber} />
    </div>
  );
}
