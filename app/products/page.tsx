const products = [
  { id: 1, name: "Jade Bangle", price: "$120", description: "Classic smooth bangle in natural green jade." },
  { id: 2, name: "Jade Pendant", price: "$85", description: "Carved jade pendant on a silk cord." },
  { id: 3, name: "Jade Ring", price: "$65", description: "Polished jade ring, available in all sizes." },
  { id: 4, name: "Jade Earrings", price: "$95", description: "Delicate drop earrings with jade inlay." },
  { id: 5, name: "Jade Bracelet", price: "$110", description: "Beaded bracelet with genuine jade stones." },
  { id: 6, name: "Jade Figurine", price: "$200", description: "Hand-carved jade figurine, a timeless gift." },
];

export default function Products() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Products</h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">Browse our collection of authentic jade pieces.</p>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div key={product.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 hover:shadow-md transition-shadow">
            <div className="h-32 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center mb-4">
              <span className="text-4xl">🪨</span>
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">{product.name}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{product.description}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="font-medium text-emerald-700">{product.price}</span>
              <button className="rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 transition-colors">
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
