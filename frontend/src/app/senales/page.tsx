import ApiDown from "@/components/ApiDown";
import Signals from "@/components/views/Signals";
import { ApiError, api } from "@/lib/api";

// Triage state is mutable, so this route must never be served from cache.
export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  try {
    const [signals, meta] = await Promise.all([api.signals(), api.meta()]);
    return <Signals items={signals.results} meta={meta} />;
  } catch (err) {
    return <ApiDown base={api.base} detail={err instanceof ApiError ? err.message : String(err)} />;
  }
}
