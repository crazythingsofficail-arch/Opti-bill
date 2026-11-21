import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  try {
    const store = getStore();
    return NextResponse.json(
      {
        status: "healthy",
        service: "Opti-X Billing",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        store: {
          readable: true,
          invoicesCount: store.invoices.length,
          customersCount: store.customers.length,
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Health check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
