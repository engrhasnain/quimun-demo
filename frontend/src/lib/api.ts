import type {
  Adoption,
  Meta,
  ModelCard,
  PortfolioSummary,
  ResidenceDetail,
  ResidenceRow,
  Signal,
} from "./types";

const BASE =
  process.env.API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Server-side fetch helper.
 *
 * The demo dataset is a fixed snapshot, so responses are revalidated on a short
 * interval rather than cached forever - that keeps triage changes visible
 * without hammering the API on every navigation.
 */
async function get<T>(path: string, revalidate = 10): Promise<T> {
  const url = `${BASE}${path}`;
  let res: Response;
  const cache =
    revalidate === 0
      ? ({ cache: "no-store" } as const)
      : ({ next: { revalidate } } as const);
  try {
    res = await fetch(url, {
      ...cache,
      headers: { accept: "application/json" },
      // Fail fast rather than hang.
      //
      // Without this, an unreachable API makes the production BUILD fail: Next
      // prerenders these pages, the fetch never returns, and it aborts each page
      // after 60s x 3 attempts. That bites exactly when you deploy the frontend
      // before the API exists - the most likely order of operations. With a
      // timeout the page prerenders as the "API unreachable" screen and
      // revalidates into real content as soon as the API answers.
      signal: AbortSignal.timeout(8000),
    });
  } catch (cause) {
    throw new ApiError(
      `Cannot reach the API at ${BASE}. Is the FastAPI server running?`,
      0,
      url,
    );
  }
  if (!res.ok) {
    throw new ApiError(`API returned ${res.status} for ${path}`, res.status, url);
  }
  return (await res.json()) as T;
}

export const api = {
  base: BASE,
  meta: () => get<Meta>("/api/meta", 300),
  summary: () => get<PortfolioSummary>("/api/portfolio/summary"),
  residences: (qs = "") =>
    get<{ as_of: string; count: number; total: number; results: ResidenceRow[] }>(
      `/api/residences${qs ? `?${qs}` : ""}`,
    ),
  residence: (slug: string) => get<ResidenceDetail>(`/api/residences/${slug}`),
  peers: (slug: string) =>
    get<{ band: string; peers: { slug: string; name: string; intensity: number; index: number; residents: number; is_self: boolean }[] }>(
      `/api/residences/${slug}/peers`,
    ),
  // Signals carry mutable triage state - never serve them from cache.
  signals: (qs = "") =>
    get<{ as_of: string; count: number; results: Signal[] }>(
      `/api/signals${qs ? `?${qs}` : ""}`,
      0,
    ),
  adoption: () => get<Adoption>("/api/modules/adoption"),
  model: () => get<ModelCard>("/api/model"),
  health: () =>
    get<{ ok: boolean; snapshot_date: string; residences: number; usage_rows: number; model_loaded: boolean }>(
      "/api/health",
      5,
    ),
};
