import { z } from "zod";
import { notFound } from "next/navigation";
import { OrderDetail } from "@/components/details";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();
  return <OrderDetail id={parsed.data} />;
}
