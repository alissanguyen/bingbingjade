/**
 * Fetches every row from a Supabase query using sequential .range() batches.
 *
 * Use ONLY for admin/internal tools that genuinely need the full table.
 * Public browsing pages must use server-side pagination (.range + count:"exact").
 *
 * Usage:
 *   const rows = await fetchAllRows((from, to) =>
 *     supabaseAdmin.from("products").select("id, name").order("name").range(from, to)
 *   );
 */
export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  batchSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await makeQuery(from, from + batchSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return all;
}
