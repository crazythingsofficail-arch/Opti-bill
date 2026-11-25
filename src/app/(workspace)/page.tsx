import { loadStore, getDashboardStats } from "@/lib/store";
import { Dashboard } from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  await loadStore();
  const initial = getDashboardStats();
  return <Dashboard initial={initial as any} />;
}
