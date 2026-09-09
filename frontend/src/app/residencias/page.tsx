import ApiDown from "@/components/ApiDown";
import Residences from "@/components/views/Residences";
import { ApiError, api } from "@/lib/api";

export const revalidate = 10;

export default async function ResidencesPage() {
  try {
    const [list, meta] = await Promise.all([api.residences("sort=index&direction=asc"), api.meta()]);
    return <Residences rows={list.results} meta={meta} />;
  } catch (err) {
    return <ApiDown base={api.base} detail={err instanceof ApiError ? err.message : String(err)} />;
  }
}
