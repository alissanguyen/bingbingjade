import { vi } from "vitest";

/**
 * A minimal fluent Supabase query-builder mock. Every chain method returns
 * itself; `.maybeSingle()` / `.single()` and awaiting the builder directly
 * both resolve to the configured result — mirrors how supabase-js query
 * builders are themselves thenable.
 */
export function chainable(result: { data?: unknown; error?: unknown; count?: number } = { data: null, error: null }) {
  const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "not", "order", "range", "or", "limit", "returns"];
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

export function storageMock(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      download: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      remove: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      createSignedUrl: vi.fn(() => Promise.resolve({ data: { signedUrl: "https://signed.example/x" }, error: null })),
      createSignedUrls: vi.fn(() => Promise.resolve({ data: [], error: null })),
      ...overrides,
    })),
  };
}
