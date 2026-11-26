import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { NextRequest } from "next/server";
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { GET, POST } from "@/app/api/[resource]/route";
import { createSessionToken } from "@/lib/auth-security";
import {
  getStore,
  saveStore,
  loadPrintDataFromStore,
  resetMemoryStoreForTesting,
} from "@/lib/store";
import { PrintPreview } from "@/components/print-preview";

describe("Order Booking -> Booking Bill -> Customer Revisit Delivery Flow", () => {
  const token = createSessionToken("test-admin");
  const headers = {
    cookie: `opti-activity=${token}`,
    "Content-Type": "application/json",
  };

  beforeEach(() => {
    resetMemoryStoreForTesting();
    const s = getStore();
    s.customers = [];
    s.prescriptions = [];
    s.invoices = [];
    s.invoice_items = [];
    s.orders = [];
    s.payments = [];
    s.uploads = [];
    s.drafts = {};
    s.shop.gst_scheme = "unregistered";
    s.profile.role = "owner";
    saveStore(s);
  });

  it("books frame + lens with optional parameters, generates Booking Bill, then completes delivery & final payment", async () => {
    const store = getStore();
    const taxId = store.taxes[0].id;

    // 1. Customer books Frame + Lens with Name, Age, Phone, optional params & Advance UPI payment
    const bookReq = new NextRequest("http://localhost:3001/api/book-order", {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: {
          name: "Aarav Sharma",
          phone: "9876543210",
          age_years: 28,
        },
        prescription: {
          od_sph: -1.5,
          os_sph: -1.25,
          source: "External: City Eye Clinic",
        },
        items: [
          {
            item_type: "frame",
            description: "Booked Frame",
            specs: { colour: "Matte Black" },
            frame_model_no: "",
            qty: 1,
            unit: "piece",
            unit_price_paise: 150000,
            discount_paise: 0,
            tax_category_id: taxId,
          },
          {
            item_type: "lens",
            description: "Essilor · single vision · 1.56 Thin",
            lens_brand: "Essilor",
            lens_code: "",
            lens_type: "single vision",
            lens_index: "1.56 Thin",
            coatings: "Blue Cut / Computer",
            tint: "Clear",
            qty: 1,
            unit: "pair",
            unit_price_paise: 100000,
            discount_paise: 0,
            tax_category_id: taxId,
          },
        ],
        advance_paise: 50000,
        payment_mode: "upi",
        reference_no: "UPI-ADV-01",
        promised_date: "2026-12-01",
      }),
    });

    const bookRes = await POST(bookReq, {
      params: Promise.resolve({ resource: "book-order" }),
    });
    expect(bookRes.status).toBe(200);
    const { orderId, invoiceId, customerId } = await bookRes.json();
    expect(orderId).toBeTruthy();
    expect(invoiceId).toBeTruthy();
    expect(customerId).toBeTruthy();

    // Verify Booking Bill state & HTML output
    const bookingPrintData = await loadPrintDataFromStore(invoiceId);
    expect(bookingPrintData.invoice.is_booking).toBe(true);
    expect(bookingPrintData.invoice.grand_total).toBe(250000);
    expect(bookingPrintData.invoice.amount_paid).toBe(50000);
    expect(bookingPrintData.invoice.balance_due).toBe(200000);

    const bookingHtml = renderToString(
      React.createElement(PrintPreview, { data: bookingPrintData, layout: "a4" }),
    );
    expect(bookingHtml).toContain("Booking Bill");
    expect(bookingHtml).toContain("Advance paid");
    expect(bookingHtml).toContain("Remaining balance");

    // 2. Customer revisits: look up customer profile & verify order has balance_due
    const detailRes = await GET(
      new NextRequest(
        `http://localhost:3001/api/customer-detail?id=${customerId}`,
        { headers },
      ),
      { params: Promise.resolve({ resource: "customer-detail" }) },
    );
    expect(detailRes.status).toBe(200);
    const detailBody = await detailRes.json();
    expect(detailBody.orders.length).toBe(1);
    expect(detailBody.orders[0].balance_due).toBe(200000);

    // 3. Take/upload delivery image
    const validPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ]);
    const form = new FormData();
    form.append("order_id", orderId);
    form.append("file", new File([validPng], "delivery.png", { type: "image/png" }));
    const uploadRes = await POST(
      new NextRequest("http://localhost:3001/api/lens-upload", {
        method: "POST",
        headers: { cookie: `opti-activity=${token}` },
        body: form,
      }),
      { params: Promise.resolve({ resource: "lens-upload" }) },
    );
    expect(uploadRes.status).toBe(200);

    // 4. Collect remaining payment (₹2000) & mark Delivered
    const completeRes = await POST(
      new NextRequest("http://localhost:3001/api/complete-order", {
        method: "POST",
        headers,
        body: JSON.stringify({
          order_id: orderId,
          amount_paise: 200000,
          mode: "cash",
          reference_no: "Final cash",
          mark_delivered: true,
        }),
      }),
      { params: Promise.resolve({ resource: "complete-order" }) },
    );
    expect(completeRes.status).toBe(200);

    // 5. Verify final Bill & delivery photo
    const finalPrintData = await loadPrintDataFromStore(invoiceId);
    expect(finalPrintData.order.status).toBe("Delivered");
    expect(finalPrintData.invoice.amount_paid).toBe(250000);
    expect(finalPrintData.invoice.balance_due).toBe(0);
    expect(finalPrintData.photo).toMatch(/^\/uploads\/lens-/);

    const finalHtml = renderToString(
      React.createElement(PrintPreview, { data: finalPrintData, layout: "a4" }),
    );
    expect(finalHtml).toContain(">Bill<");
    expect(finalHtml).not.toContain("Booking Bill");
  });
});
