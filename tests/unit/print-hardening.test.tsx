import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
import { PrintPreview } from "../../src/components/print-preview";
import { renderInvoicePdf } from "../../src/lib/pdf";

describe("BUG-015: Null-safe print preview & PDF generation", () => {
  const baseData: any = {
    invoice: {
      id: "10000000-0000-4000-8000-000000000001",
      invoice_no: "OX/26-27/0001",
      type: "tax_invoice",
      status: "finalised",
      display_status: "finalised",
      finalised_at: "2026-11-16T10:00:00Z",
      customer_id: null,
      customer_snapshot: null, // Null customer snapshot
      shop_snapshot: null,     // Null shop snapshot
      subtotal: 10000,
      discount_total: 0,
      taxable_total: 10000,
      cgst: 900,
      sgst: 900,
      igst: 0,
      round_off: 0,
      grand_total: 11800,
      amount_paid: 11800,
      balance_due: 0,
      refund_due: 0,
      place_of_supply_state_code: "29",
      is_interstate: false,
    },
    items: [
      {
        id: "test-line",
        position: 1,
        qty: 1,
        unit: "pair",
        unit_price_paise: 10000,
        discount_paise: 0,
        taxable_paise: 10000,
        gst_rate_bp: 1800,
        cgst_rate_bp: 900,
        sgst_rate_bp: 900,
        igst_rate_bp: 0,
        cgst_paise: 900,
        sgst_paise: 900,
        igst_paise: 0,
        description: "Test Frame",
        item_type: "frame",
        frame_model_no: "OX-FRAME-1",
        lens_brand: "",
        hsn_code: "9003",
        specs: {},
      },
    ],
    payments: [],
    order: {
      id: "ord-1",
      order_no: "OX-ORD-0001",
      lab_name: "In-house",
      promised_date: null,
      notes: "",
    },
    prescription: null,
    photo: null,
    upiQr: null,
    originalNumber: null,
    logo: null,
    signature: null,
  };

  it("renders PrintPreview without crashing when customer_snapshot or shop_snapshot is null", () => {
    const html = renderToString(<PrintPreview data={baseData} layout="a4" />);
    expect(html).not.toContain("Made by Mudasir Shariff");
    expect(html).not.toContain("hello@opti-x.in");
    expect(html).not.toContain("8123649448");
    expect(html).not.toContain("TAX INVOICE");
    expect(html).toContain(">Bill<");
    expect(html).toContain("@page{size:A4 portrait;margin:0}");
  });

  it("renders PDF layouts without crashing when customer_snapshot or shop_snapshot is null", async () => {
    const pdfBuffer = await renderInvoicePdf(baseData, "a4", "Original for Recipient");
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
  });
});
