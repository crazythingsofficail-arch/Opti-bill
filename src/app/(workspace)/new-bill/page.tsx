import { Suspense } from "react";
import { BillWizard } from "@/components/bill-wizard";
import { Skeleton } from "@/components/ui";
export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <BillWizard />
    </Suspense>
  );
}
