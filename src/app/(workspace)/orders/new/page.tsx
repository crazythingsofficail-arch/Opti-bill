import { Suspense } from "react";
import { OrderBooking } from "@/components/order-booking";
import { Skeleton } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <OrderBooking />
    </Suspense>
  );
}
