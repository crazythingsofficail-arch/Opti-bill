import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import { loadStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await loadStore();
  return (
    <Providers profile={store.profile} shop={store.shop}>
      <Shell>{children}</Shell>
    </Providers>
  );
}
