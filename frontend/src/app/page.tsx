import ApiDown from "@/components/ApiDown";
import Overview from "@/components/views/Overview";
import { ApiError, api } from "@/lib/api";

export const revalidate = 10;

export default async function OverviewPage() {
  try {
    const [summary, signals] = await Promise.all([api.summary(), api.signals()]);
    return <Overview data={summary} queue={signals.results} />;
  } catch (err) {
    const detail = err instanceof ApiError ? err.message : String(err);
    return <ApiDown base={api.base} detail={detail} />;
  }
}
