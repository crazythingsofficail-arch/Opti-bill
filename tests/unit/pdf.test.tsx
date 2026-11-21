import { it, expect, vi } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
vi.mock("server-only", () => ({}));
import { renderInvoicePdf } from "../../src/lib/pdf";
import { calculateInvoice } from "../../src/lib/money";
import type { PrintData } from "../../src/lib/types";
// Synthetic records exist in tests only; nothing is inserted into the application.
it("renders all four PDF layouts with a real font and no network dependencies", async () => {
  const totals = calculateInvoice(
    [
      {
        qty: 1,
        unit_price_paise: 123456,
        discount_paise: 3456,
        gst_rate_bp: 1800,
      },
    ],
    0,
    false,
    true,
  );
  const data = {
    invoice: {
      id: "10000000-0000-4000-8000-000000000001",
      invoice_no: "OX/26-27/0001",
      type: "tax_invoice",
      status: "finalised",
      display_status: "finalised",
      finalised_at: "2026-11-16T10:00:00Z",
      customer_snapshot: {
        name: "Test customer",
        address: "Test address",
        city: "Test city",
      },
      shop_snapshot: {
        name: "Test optical shop",
        legal_name: "Test optical shop",
        address: "Test address",
        city: "Test city",
        state: "Test state",
        pincode: "000000",
        phone: "+919000000001",
        email: "test@example.test",
        gstin: "27AAPFU0939F1ZV",
        gst_scheme: "regular",
        reverse_charge_text: "Test reverse-charge declaration",
        terms_text: "Test invoice terms",
        warranty_text: "Test warranty policy",
        return_policy_text: "Test returns policy",
      },
      place_of_supply_state_code: "27",
      is_interstate: false,
      ...totals,
      amount_paid: 10000,
      balance_due: totals.grand_total - 10000,
      refund_due: 0,
    },
    items: [
      {
        ...totals.items[0],
        id: "test-line",
        position: 1,
        cgst_rate_bp: 900,
        sgst_rate_bp: 900,
        igst_rate_bp: 0,
        description: "Test progressive lens and frame",
        item_type: "lens",
        frame_model_no: "TEST",
        lens_brand: "Test brand",
        hsn_code: "1234",
        unit: "pair",
        specs: { lens_index: "Test index", coatings: "Test coating" },
      },
    ],
    payments: [],
    order: {
      order_no: "ORD-TEST",
      promised_date: "2026-11-20",
      lab_name: "Test lab",
      notes: "Test job note",
    },
    prescription: {
      test_date: "2026-11-16",
      examiner_name: "Test examiner",
      source: "in_shop",
      od_sph: 1.25,
      od_cyl: -0.5,
      od_axis: 90,
      od_add_power: 1.25,
      od_pd_distance: 31,
      os_sph: 1,
      os_cyl: -0.75,
      os_axis: 90,
      os_add_power: 1.25,
      os_pd_distance: 32,
      bin_pd: 63,
      remarks: "Test clinical remark",
    },
    photo: "/uploads/lens-acc6d3f6-21b3-4c19-8cab-0fb7e097e430.jpg",
    upiQr: null,
    originalNumber: null,
    logo: null,
    signature: null,
  } as unknown as PrintData;
  await mkdir("test-artifacts/pdf", { recursive: true });
  for (const layout of ["a4", "thermal", "job", "prescription"] as const) {
    const bytes = await renderInvoicePdf(data, layout);
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(1000);
    await writeFile(`test-artifacts/pdf/${layout}.pdf`, bytes);
  }
});
