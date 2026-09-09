import ApiDown from "@/components/ApiDown";
import Modules from "@/components/views/Modules";
import { ApiError, api } from "@/lib/api";

export const revalidate = 10;

export default async function ModulesPage() {
  try {
    const [adoption, summary] = await Promise.all([api.adoption(), api.summary()]);
    return <Modules data={adoption} summary={summary} />;
  } catch (err) {
    return <ApiDown base={api.base} detail={err instanceof ApiError ? err.message : String(err)} />;
  }
}
