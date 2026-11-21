import { Suspense } from "react";
import { Settings } from "@/components/settings";
import { Skeleton } from "@/components/ui";
export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <Settings />
    </Suspense>
  );
}
