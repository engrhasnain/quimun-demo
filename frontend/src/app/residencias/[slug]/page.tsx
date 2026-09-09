import { notFound } from "next/navigation";

import ApiDown from "@/components/ApiDown";
import ResidenceDetail from "@/components/views/ResidenceDetail";
import { ApiError, api } from "@/lib/api";

export default async function ResidencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const [d, meta, peers] = await Promise.all([
      api.residence(slug),
      api.meta(),
      api.peers(slug),
    ]);
    return <ResidenceDetail d={d} meta={meta} peers={peers} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    return <ApiDown base={api.base} detail={err instanceof ApiError ? err.message : String(err)} />;
  }
}
