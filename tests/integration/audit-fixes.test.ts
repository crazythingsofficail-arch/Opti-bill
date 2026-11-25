import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/[resource]/route";
import {
  createSessionToken,
  verifyTotpCode,
  generateTotpSecret,
} from "@/lib/auth-security";
import {
  getStore,
  saveStore,
  saveCustomer,
  saveLens,
  saveDraft,
  finaliseInvoice,
  creditInvoice,
  cancelInvoice,
  getDashboardStats,
  getReportsData,
  resetMemoryStoreForTesting,
} from "@/lib/store";
import crypto from "node:crypto";

function generateCurrentTotp(secret: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.replace(/=+$/g, "").toUpperCase();
  let bits = 0;
  let val = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    val = (val << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const key = Buffer.from(out);
  const buf = Buffer.alloc(8);
  let c = BigInt(Math.floor(Date.now() / 30000));
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

describe("Audit Fixes Regression Suite", () => {
  const token = createSessionToken("test-admin");
  const headers = {
    cookie: `opti-activity=${token}`,
    "Content-Type": "application/json",
  };

  beforeEach(() => {
    resetMemoryStoreForTesting();
    const s = getStore();
    s.invoices = [];
    s.invoice_items = [];
    s.orders = [];
    s.payments = [];
    s.drafts = {};
    s.lenses = [];
    s.shop.gst_scheme = "regular";
    s.shop.state_code = "29";
    s.profile.role = "owner";
    saveStore(s);
  });

  it("preserves 0% GST rate on finalisation and tax creation instead of falling back to 12%", async () => {
    const postTaxReq = new NextRequest("http://localhost:3001/api/taxes", {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          name: "Zero Rated Eye Test",
          hsn_code: "9993",
          gst_rate_bp: 0,
          effective_from: "2020-01-01",
          is_active: true,
        },
      }),
    });
    const taxRes = await POST(postTaxReq, { params: Promise.resolve({ resource: "taxes" }) });
    expect(taxRes.status).toBe(200);
    const { id: zeroTaxId } = await taxRes.json();

    const savedTax = getStore().taxes.find((t) => t.id === zeroTaxId);
    expect(savedTax?.gst_rate_bp).toBe(0);

    const custId = saveCustomer({ name: "Zero Tax Guest", phone: "+919876500001" });
    const draftId = crypto.randomUUID();
    saveDraft(draftId, {
      id: draftId,
      customer_id: custId,
      place_of_supply_state_code: "29",
      items: [
        {
          item_type: "service",
          description: "Clinical Eye Exam",
          qty: 1,
          unit: "service",
          unit_price_paise: 50000,
          discount_paise: 0,
          tax_category_id: zeroTaxId,
        },
      ],
    });

    const invId = finaliseInvoice(draftId, "key-zero-1", [{ amount_paise: 50000, mode: "cash" }]);
    const inv = getStore().invoices.find((i) => i.id === invId)!;
    expect(inv.cgst).toBe(0);
    expect(inv.sgst).toBe(0);
    expect(inv.igst).toBe(0);
    expect(inv.grand_total).toBe(50000);
  });

  it("treats blank shop.state_code as intra-state rather than charging IGST", () => {
    const s = getStore();
    s.shop.state_code = "";
    saveStore(s);

    const tax12 = s.taxes.find((t) => t.gst_rate_bp === 1200)!;
    const custId = saveCustomer({ name: "Intra Guest", phone: "+919876500002" });
    const draftId = crypto.randomUUID();
    saveDraft(draftId, {
      id: draftId,
      customer_id: custId,
      place_of_supply_state_code: "29",
      items: [
        {
          item_type: "frame",
          description: "Standard Frame",
          qty: 1,
          unit: "piece",
          unit_price_paise: 100000,
          discount_paise: 0,
          tax_category_id: tax12.id,
        },
      ],
    });

    const invId = finaliseInvoice(draftId, "key-intra-1", []);
    const inv = getStore().invoices.find((i) => i.id === invId)!;
    expect(inv.is_interstate).toBe(false);
    expect(inv.igst).toBe(0);
    expect(inv.cgst).toBe(6000);
    expect(inv.sgst).toBe(6000);
  });

  it("preserves full lens specs on finalised invoice items", () => {
    const s = getStore();
    const lensId = saveLens({
      lens_code: "ZEISS-167-BC",
      brand: "Zeiss",
      name: "ClearView 1.67 BlueGuard",
      lens_type: "single vision",
      lens_index: "1.67 Ultra Thin",
      coatings: "Blue Cut / Computer",
      tint: "Clear",
      mrp_paise: 450000,
      stock_qty: 5,
    });
    const custId = saveCustomer({ name: "Lens Guest", phone: "+919876500003" });
    const draftId = crypto.randomUUID();
    saveDraft(draftId, {
      id: draftId,
      customer_id: custId,
      items: [
        {
          item_type: "lens",
          description: "Zeiss · single vision · 1.67 Ultra Thin",
          lens_id: lensId,
          lens_brand: "Zeiss",
          lens_code: "ZEISS-167-BC",
          lens_type: "single vision",
          lens_index: "1.67 Ultra Thin",
          coatings: "Blue Cut / Computer",
          tint: "Clear",
          qty: 1,
          unit: "pair",
          unit_price_paise: 450000,
          discount_paise: 0,
          tax_category_id: s.taxes[0].id,
        },
      ],
    });

    const invId = finaliseInvoice(draftId, "key-lens-1", []);
    const item = getStore().invoice_items.find((it) => it.invoice_id === invId)!;
    expect(item.lens_id).toBe(lensId);
    expect(item.lens_code).toBe("ZEISS-167-BC");
    expect(item.lens_type).toBe("single vision");
    expect(item.lens_index).toBe("1.67 Ultra Thin");
    expect(item.coatings).toBe("Blue Cut / Computer");
    expect(getStore().lenses.find((l) => l.id === lensId)?.stock_qty).toBe(4);
  });

  it("excludes cancelled invoices from dashboard/dues and nets credit notes cleanly in reports", async () => {
    const s = getStore();
    const tax12 = s.taxes.find((t) => t.gst_rate_bp === 1200)!;
    const custId = saveCustomer({ name: "Accounting Guest", phone: "+919876500004" });

    // Invoice 1: Cancelled (unpaid)
    const d1 = crypto.randomUUID();
    saveDraft(d1, {
      id: d1,
      customer_id: custId,
      items: [{ item_type: "frame", description: "Frame A", qty: 1, unit_price_paise: 100000, discount_paise: 0, tax_category_id: tax12.id }],
    });
    const inv1 = finaliseInvoice(d1, "k1", []);
    cancelInvoice(inv1, "Entered by mistake", false);

    // Invoice 2: Credited in full
    const d2 = crypto.randomUUID();
    saveDraft(d2, {
      id: d2,
      customer_id: custId,
      items: [{ item_type: "frame", description: "Frame B", qty: 1, unit_price_paise: 200000, discount_paise: 0, tax_category_id: tax12.id }],
    });
    const inv2 = finaliseInvoice(d2, "k2", []);
    creditInvoice(inv2, "Returned", false);

    const dash = getDashboardStats();
    expect(dash.stats.today).toBe(0);
    expect(dash.stats.dues).toBe(0);

    const rep = getReportsData("2020-01-01", "2099-12-31");
    expect(rep.daily[0].sales).toBe(0);
    expect(rep.daily[0].tax).toBe(0);
    expect(rep.ageing.every((a) => a.amount === 0)).toBe(true);

    // Test invoice filter by status
    const resCancelled = await GET(
      new NextRequest("http://localhost:3001/api/invoices?status=cancelled", { headers }),
      { params: Promise.resolve({ resource: "invoices" }) },
    );
    const bodyCancelled = await resCancelled.json();
    expect(bodyCancelled.rows.length).toBe(1);
    expect(bodyCancelled.rows[0].id).toBe(inv1);
  });

  it("supports share links, customer export PDF/JSON, MFA TOTP setup, and rejects unknown POST", async () => {
    const s = getStore();
    const custId = saveCustomer({ name: "Export Guest", phone: "+919876500005" });
    const draftId = crypto.randomUUID();
    saveDraft(draftId, {
      id: draftId,
      customer_id: custId,
      items: [{ item_type: "frame", description: "Frame Share", qty: 1, unit_price_paise: 100000, discount_paise: 0, tax_category_id: s.taxes[0].id }],
    });
    const invId = finaliseInvoice(draftId, "k-share", []);

    // Share link + public shared-pdf download
    const shareRes = await POST(
      new NextRequest("http://localhost:3001/api/share", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: invId }),
      }),
      { params: Promise.resolve({ resource: "share" }) },
    );
    expect(shareRes.status).toBe(200);
    const { url } = await shareRes.json();
    expect(url).toContain("/api/shared-pdf?token=");
    const shareToken = new URL(url).searchParams.get("token")!;

    const pdfRes = await GET(
      new NextRequest(`http://localhost:3001/api/shared-pdf?token=${encodeURIComponent(shareToken)}`),
      { params: Promise.resolve({ resource: "shared-pdf" }) },
    );
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("content-type")).toBe("application/pdf");

    // Customer export JSON & PDF
    const exportJsonRes = await POST(
      new NextRequest("http://localhost:3001/api/customer-export", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: custId, format: "json" }),
      }),
      { params: Promise.resolve({ resource: "customer-export" }) },
    );
    expect(exportJsonRes.status).toBe(200);
    const exportedData = await exportJsonRes.json();
    expect(exportedData.customer.name).toBe("Export Guest");

    const exportPdfRes = await POST(
      new NextRequest("http://localhost:3001/api/customer-export", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: custId, format: "pdf" }),
      }),
      { params: Promise.resolve({ resource: "customer-export" }) },
    );
    expect(exportPdfRes.status).toBe(200);
    expect(exportPdfRes.headers.get("content-type")).toBe("application/pdf");

    // MFA Enroll + Verify + Require
    const enrollRes = await POST(
      new NextRequest("http://localhost:3001/api/mfa-enroll", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ resource: "mfa-enroll" }) },
    );
    expect(enrollRes.status).toBe(200);
    const enrolled = await enrollRes.json();
    expect(enrolled.totp.secret).toBeDefined();
    expect(enrolled.totp.qr_code).toContain("<svg");

    const code = generateCurrentTotp(enrolled.totp.secret);
    expect(verifyTotpCode(enrolled.totp.secret, code)).toBe(true);

    const verifyRes = await POST(
      new NextRequest("http://localhost:3001/api/mfa-verify", {
        method: "POST",
        headers,
        body: JSON.stringify({ factorId: enrolled.id, code }),
      }),
      { params: Promise.resolve({ resource: "mfa-verify" }) },
    );
    expect(verifyRes.status).toBe(200);

    const reqMfaRes = await POST(
      new NextRequest("http://localhost:3001/api/mfa-require", {
        method: "POST",
        headers,
        body: JSON.stringify({ required: true }),
      }),
      { params: Promise.resolve({ resource: "mfa-require" }) },
    );
    expect(reqMfaRes.status).toBe(200);
    expect(getStore().shop.require_owner_mfa).toBe(true);

    // Unknown POST endpoint returns 400
    const unknownRes = await POST(
      new NextRequest("http://localhost:3001/api/unknown-action", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ resource: "unknown-action" }) },
    );
    expect(unknownRes.status).toBe(400);

    // Non-owner blocked on owner-only endpoints
    const staffToken = createSessionToken("staff-user-id");
    const staffStore = getStore();
    staffStore.members = [
      {
        id: "staff-user-id",
        shop_id: staffStore.shop.id,
        full_name: "Staff Member",
        role: "staff",
        is_active: true,
      },
    ];
    saveStore(staffStore);

    const forbiddenRes = await POST(
      new NextRequest("http://localhost:3001/api/cancel", {
        method: "POST",
        headers: {
          cookie: `opti-activity=${staffToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: invId, reason: "Unauthorized attempt" }),
      }),
      { params: Promise.resolve({ resource: "cancel" }) },
    );
    expect(forbiddenRes.status).toBe(400);
    const forbiddenBody = await forbiddenRes.json();
    expect(forbiddenBody.error).toMatch(/Owner access required/i);
  });
});
