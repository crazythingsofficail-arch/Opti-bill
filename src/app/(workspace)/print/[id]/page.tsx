import { z } from "zod";
import { loadPrintData } from "@/lib/data";
import { PrintPreview } from "@/components/print-preview";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const layout = z
    .enum(["a4", "thermal", "job", "prescription"])
    .catch("a4")
    .parse(query.layout);
  const data = await loadPrintData(z.uuid().parse(id));
  return <PrintPreview data={data} layout={layout} />;
}
