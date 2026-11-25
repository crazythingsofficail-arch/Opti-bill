import { notFound } from "next/navigation";
import { Customers, Inventory, Invoices, Orders } from "@/components/records";
import { Reports } from "@/components/reports";
import { Support } from "@/components/support";
import { Legal } from "@/components/legal";

export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  switch (section) {
    case "customers":
      return <Customers />;
    case "invoices":
      return <Invoices />;
    case "payments":
      return <Invoices dues />;
    case "orders":
      return <Orders />;
    case "inventory":
      return <Inventory />;
    case "reports":
      return <Reports />;
    case "support":
      return <Support />;
    case "privacy":
      return <Legal kind="privacy" />;
    case "terms":
      return <Legal kind="terms" />;
    case "more":
      return <Legal kind="more" />;
    default:
      notFound();
  }
}
