import { notFound } from "next/navigation";
import { Customers, Inventory } from "@/components/records";
import { Reports } from "@/components/reports";

export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  switch (section) {
    case "customers":
      return <Customers />;
    case "inventory":
      return <Inventory />;
    case "reports":
      return <Reports />;
    default:
      notFound();
  }
}
