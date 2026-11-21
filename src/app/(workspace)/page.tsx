import { getDashboardStats } from "@/lib/store";
import { Dashboard } from "@/components/dashboard";

export default function Home() {
  const initial = getDashboardStats();
  return <Dashboard initial={initial as any} />;
}
