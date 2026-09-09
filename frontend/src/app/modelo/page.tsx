import ApiDown from "@/components/ApiDown";
import Model from "@/components/views/Model";
import { ApiError, api } from "@/lib/api";

export const revalidate = 10;

export default async function ModelPage() {
  try {
    return <Model card={await api.model()} />;
  } catch (err) {
    return <ApiDown base={api.base} detail={err instanceof ApiError ? err.message : String(err)} />;
  }
}
