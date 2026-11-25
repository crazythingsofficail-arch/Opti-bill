import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/[resource]/route";
import { createSessionToken } from "@/lib/auth-security";
import { getStore, saveStore, saveCustomer, saveFrame, saveDraft, finaliseInvoice } from "@/lib/store";

describe("High & Medium API Features Hardening (BUG-007 through BUG-014)", () => {
  const token = createSessionToken("test-admin");
  const headers = {
    cookie: `opti-activity=${token}`,
    "Content-Type": "application/json",
  };

  it("BUG-009: lists taxes via GET /api/taxes and saves new tax category via POST /api/taxes", async () => {
    // 1. GET /api/taxes
    const getReq = new NextRequest("http://localhost:3001/api/taxes?page=1", { headers });
    const getRes = await GET(getReq, { params: Promise.resolve({ resource: "taxes" }) });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(Array.isArray(getBody.rows)).toBe(true);
    expect(getBody.count).toBeGreaterThan(0);

    // 2. POST /api/taxes
    const postReq = new NextRequest("http://localhost:3001/api/taxes", {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          name: "Contact Lens Solution (18%)",
          hsn_code: "3307",
          gst_rate_bp: 1800,
          effective_from: "2026-01-01",
          is_active: true,
        },
      }),
    });
    const postRes = await POST(postReq, { params: Promise.resolve({ resource: "taxes" }) });
    expect(postRes.status).toBe(200);
    const postBody = await postRes.json();
    expect(postBody.id).toBeDefined();

    // Verify persisted
    const store = getStore();
    const found = store.taxes.find((t) => t.id === postBody.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe("Contact Lens Solution (18%)");
    expect(found?.gst_rate_bp).toBe(1800);
  });

  it("BUG-008: updates order status via POST /api/orders", async () => {
    const store = getStore();
    const orderId = crypto.randomUUID();
    store.orders.push({
      id: orderId,
      shop_id: store.shop.id,
      customer_id: crypto.randomUUID(),
      prescription_id: null,
      order_no: "ORD-TEST-001",
      status: "Ordered",
      lab_name: "Local Lab",
      lab_sent_at: null,
      promised_date: "2026-12-01",
      delivered_at: null,
      notes: null,
      created_at: new Date().toISOString(),
    });
    saveStore(store);

    const req = new NextRequest("http://localhost:3001/api/orders", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: orderId,
        status: "Delivered",
        lab_name: "Apex Optical Lab",
        promised_date: "2026-12-05",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ resource: "orders" }) });
    expect(res.status).toBe(200);

    const updated = getStore().orders.find((o) => o.id === orderId);
    expect(updated?.status).toBe("Delivered");
    expect(updated?.lab_name).toBe("Apex Optical Lab");
    expect(updated?.promised_date).toBe("2026-12-05");
  });

  it("BUG-007: cancels invoice and restocks frame via POST /api/cancel", async () => {
    const store = getStore();
    const frameId = saveFrame({
      sku: "FRM-CANCEL-TEST",
      brand: "RayBan",
      model_no: "RB-CANCEL",
      color: "Black",
      retail_price_paise: 500000,
      cost_price_paise: 250000,
      stock_qty: 10,
    });

    const custId = saveCustomer({
      name: "Cancel Customer",
      phone: "+919876543211",
      state_code: "29",
    });

    const draftId = crypto.randomUUID();
    saveDraft(draftId, {
      id: draftId,
      customer_id: custId,
      items: [
        {
          item_type: "frame",
          frame_id: frameId,
          frame_model_no: "RB-CANCEL",
          description: "RayBan Frame",
          unit_price_paise: 500000,
          qty: 2,
          unit: "piece",
          discount_paise: 0,
          tax_category_id: store.taxes[0].id,
          gst_rate_bp: 1200,
        },
      ],
      payments: [{ amount_paise: 560000, mode: "upi", reference_no: "UPI-REF" }],
    });

    const invoiceId = finaliseInvoice(draftId, "key-cancel-1", [{ amount_paise: 560000, mode: "upi" }]);
    expect(getStore().frames.find((f) => f.id === frameId)?.stock_qty).toBe(8);

    // Cancel invoice with restock: true
    const req = new NextRequest("http://localhost:3001/api/cancel", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: invoiceId,
        reason: "Customer cancelled before collection",
        restock: true,
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ resource: "cancel" }) });
    expect(res.status).toBe(200);

    const inv = getStore().invoices.find((i) => i.id === invoiceId);
    expect(inv?.status).toBe("cancelled");
    expect(inv?.cancel_reason).toBe("Customer cancelled before collection");
    // Frame restocked from 8 back to 10
    expect(getStore().frames.find((f) => f.id === frameId)?.stock_qty).toBe(10);
  });

  it("BUG-007: creates credit note via POST /api/credit", async () => {
    const store = getStore();
    const custId = saveCustomer({
      name: "Credit Customer",
      phone: "+919876543212",
      state_code: "29",
    });

    const draftId = crypto.randomUUID();
    saveDraft(draftId, {
      id: draftId,
      customer_id: custId,
      items: [
        {
          item_type: "lens",
          description: "Single Vision Lenses",
          unit_price_paise: 200000,
          qty: 1,
          unit: "pair",
          discount_paise: 0,
          tax_category_id: store.taxes[0].id,
          gst_rate_bp: 1200,
        },
      ],
      payments: [{ amount_paise: 224000, mode: "cash" }],
    });

    const invoiceId = finaliseInvoice(draftId, "key-credit-1", [{ amount_paise: 224000, mode: "cash" }]);

    const req = new NextRequest("http://localhost:3001/api/credit", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: invoiceId,
        reason: "Wrong lens power ordered",
        restock: false,
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ resource: "credit" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBeDefined();

    const currentStore = getStore();
    const orig = currentStore.invoices.find((i) => i.id === invoiceId);
    expect(orig?.status).toBe("credited");

    const cn = currentStore.invoices.find((i) => i.id === body.id);
    expect(cn).toBeDefined();
    expect(cn?.type).toBe("credit_note");
    expect(cn?.credit_reason).toBe("Wrong lens power ordered");
    expect(cn?.original_invoice_id).toBe(invoiceId);
    expect(cn?.grand_total).toBe(-orig!.grand_total);
  });

  it("BUG-007: reverses payment via POST /api/reverse", async () => {
    const store = getStore();
    const custId = saveCustomer({ name: "Refund Customer", phone: "+919876543213" });
    const draftId = crypto.randomUUID();
    saveDraft(draftId, {
      id: draftId,
      customer_id: custId,
      items: [
        {
          item_type: "frame",
          description: "Test Frame",
          unit_price_paise: 100000,
          qty: 1,
          tax_category_id: store.taxes[0].id,
          gst_rate_bp: 1200,
        },
      ],
      payments: [{ amount_paise: 100000, mode: "upi" }],
    });

    const invoiceId = finaliseInvoice(draftId, "key-rev-1", [{ amount_paise: 100000, mode: "upi" }]);
    const payment = getStore().payments.find((p) => p.invoice_id === invoiceId);
    expect(payment).toBeDefined();

    const req = new NextRequest("http://localhost:3001/api/reverse", {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: payment!.id,
        reason: "Duplicate charge refunded",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ resource: "reverse" }) });
    expect(res.status).toBe(200);

    const updatedInv = getStore().invoices.find((i) => i.id === invoiceId);
    expect(updatedInv?.amount_paid).toBe(0);
    expect(updatedInv?.balance_due).toBe(updatedInv?.grand_total);
  });

  it("BUG-010: removes lens photo via POST /api/lens-remove and brand image via POST /api/brand-remove", async () => {
    const store = getStore();
    const orderId = "order-photo-test";
    store.uploads.push({
      id: "upload-1",
      order_id: orderId,
      storage_path: "/uploads/lens-dummy.jpg",
      file_size: 1024,
      created_at: new Date().toISOString(),
    });
    store.shop.logo_path = "/uploads/brand-logo-dummy.jpg";
    saveStore(store);

    // Remove lens photo
    const lensReq = new NextRequest("http://localhost:3001/api/lens-remove", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: orderId }),
    });
    const lensRes = await POST(lensReq, { params: Promise.resolve({ resource: "lens-remove" }) });
    expect(lensRes.status).toBe(200);
    expect(getStore().uploads.some((u) => u.order_id === orderId)).toBe(false);

    // Remove brand logo
    const brandReq = new NextRequest("http://localhost:3001/api/brand-remove", {
      method: "POST",
      headers,
      body: JSON.stringify({ kind: "logo" }),
    });
    const brandRes = await POST(brandReq, { params: Promise.resolve({ resource: "brand-remove" }) });
    expect(brandRes.status).toBe(200);
    expect(getStore().shop.logo_path).toBeNull();
  });

  it("BUG-011: manages members and data requests (DPDP rights)", async () => {
    // 1. Members
    const inviteReq = new NextRequest("http://localhost:3001/api/invite", {
      method: "POST",
      headers,
      body: JSON.stringify({
        full_name: "Dr. Smith",
        email: "smith@opti-x.in",
        role: "optometrist",
      }),
    });
    const inviteRes = await POST(inviteReq, { params: Promise.resolve({ resource: "invite" }) });
    expect(inviteRes.status).toBe(200);

    const membersReq = new NextRequest("http://localhost:3001/api/members", { headers });
    const membersRes = await GET(membersReq, { params: Promise.resolve({ resource: "members" }) });
    expect(membersRes.status).toBe(200);
    const membersBody = await membersRes.json();
    expect(membersBody.rows.some((m: any) => m.full_name === "Dr. Smith")).toBe(true);

    // 2. Data rights requests & erasure
    const custId = saveCustomer({ name: "DPDP Customer", phone: "+919999988888" });
    const reqReq = new NextRequest("http://localhost:3001/api/requests", {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer_id: custId,
        type: "erasure",
        details: "Customer requested complete data erasure",
      }),
    });
    const reqRes = await POST(reqReq, { params: Promise.resolve({ resource: "requests" }) });
    expect(reqRes.status).toBe(200);
    const reqBody = await reqRes.json();

    const getReqs = new NextRequest("http://localhost:3001/api/requests", { headers });
    const getReqsRes = await GET(getReqs, { params: Promise.resolve({ resource: "requests" }) });
    expect(getReqsRes.status).toBe(200);
    const getReqsBody = await getReqsRes.json();
    expect(getReqsBody.rows.some((r: any) => r.id === reqBody.id)).toBe(true);

    // Process erasure
    const eraseReq = new NextRequest("http://localhost:3001/api/erase", {
      method: "POST",
      headers,
      body: JSON.stringify({ id: reqBody.id }),
    });
    const eraseRes = await POST(eraseReq, { params: Promise.resolve({ resource: "erase" }) });
    expect(eraseRes.status).toBe(200);

    const erasedCust = getStore().customers.find((c) => c.id === custId);
    expect(erasedCust?.name).toBe("Erased Customer");
    expect(erasedCust?.anonymised_at).toBeDefined();
  });

  it("BUG-013: safely escapes and quotes CSV fields with commas and special characters in export", async () => {
    const store = getStore();
    const custId = saveCustomer({ name: "Smith, John Jr.", phone: "+919876543299" });
    const draftId = crypto.randomUUID();
    saveDraft(draftId, {
      id: draftId,
      customer_id: custId,
      items: [
        {
          item_type: "frame",
          description: 'Special, "Titanium" Frame, Gold',
          unit_price_paise: 400000,
          qty: 1,
          tax_category_id: store.taxes[0].id,
          gst_rate_bp: 1200,
        },
      ],
      payments: [{ amount_paise: 448000, mode: "Card, Credit" }],
    });
    finaliseInvoice(draftId, "key-csv-1", [{ amount_paise: 448000, mode: "Card, Credit" }]);

    const req = new NextRequest("http://localhost:3001/api/export", {
      method: "POST",
      headers,
      body: JSON.stringify({ section: "modes" }),
    });
    const res = await POST(req, { params: Promise.resolve({ resource: "export" }) });
    expect(res.status).toBe(200);
    const csv = await res.text();
    expect(csv).toContain('"Card, Credit"');
  });

  it("BUG-012: idempotent invoice finalisation prevents duplicate numbers on double submits", async () => {
    const custId = saveCustomer({ name: "Idempotent Customer", phone: "+919876543277" });
    const draftId = crypto.randomUUID();
    saveDraft(draftId, {
      id: draftId,
      customer_id: custId,
      items: [
        {
          item_type: "frame",
          description: "Anti-reflective Frame",
          unit_price_paise: 150000,
          qty: 1,
          discount_paise: 0,
        },
      ],
      payments: [{ amount_paise: 168000, mode: "cash" }],
    });

    // Finalise invoice first time
    const id1 = finaliseInvoice(draftId, "key-idem-1", [{ amount_paise: 168000, mode: "cash" }]);
    const inv1 = getStore().invoices.find((i) => i.id === id1);
    const invoiceNo1 = inv1?.invoice_no;

    // Simulate concurrent or duplicate double-click request
    const id2 = finaliseInvoice(draftId, "key-idem-1", [{ amount_paise: 168000, mode: "cash" }]);
    expect(id2).toBe(id1);

    const inv2 = getStore().invoices.find((i) => i.id === id2);
    expect(inv2?.invoice_no).toBe(invoiceNo1);

    // Verify no duplicate invoice was created in store
    const matchingInvoices = getStore().invoices.filter((i) => i.id === id1);
    expect(matchingInvoices.length).toBe(1);
  });

  it("BUG-014: returns store diagnostics on /health and /api/health", async () => {
    const req = new NextRequest("http://localhost:3001/api/health");
    const res = await GET(req, { params: Promise.resolve({ resource: "health" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.store).toBeDefined();
    expect(body.store.readable).toBe(true);
  });

  it("BUG-016: preserves 0% GST rate on tax creation and invoice finalisation", async () => {
    const store = getStore();
    store.shop.gst_scheme = "regular";
    store.shop.state_code = "29";
    saveStore(store);

    const taxReq = new NextRequest("http://localhost:3001/api/taxes", {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          name: "Zero Rated Test",
          hsn_code: "9993",
          gst_rate_bp: 0,
          effective_from: "2020-01-01",
          is_active: true,
        },
      }),
    });
    const taxRes = await POST(taxReq, { params: Promise.resolve({ resource: "taxes" }) });
    expect(taxRes.status).toBe(200);
    const { id: zeroTaxId } = await taxRes.json();
    expect(getStore().taxes.find((t) => t.id === zeroTaxId)?.gst_rate_bp).toBe(0);

    const custId = saveCustomer({ name: "Zero Tax Cust", phone: "+919876500001", state_code: "29" });
    const draftId = crypto.randomUUID();
    saveDraft(draftId, {
      id: draftId,
      customer_id: custId,
      place_of_supply_state_code: "29",
      items: [
        {
          item_type: "service",
          description: "Comprehensive Eye Exam",
          unit_price_paise: 50000,
          qty: 1,
          unit: "service",
          discount_paise: 0,
          tax_category_id: zeroTaxId,
        },
      ],
      payments: [{ amount_paise: 50000, mode: "cash" }],
    });

    const invId = finaliseInvoice(draftId, "key-zero-1", [{ amount_paise: 50000, mode: "cash" }]);
    const inv = getStore().invoices.find((i) => i.id === invId)!;
    expect(inv.cgst).toBe(0);
    expect(inv.sgst).toBe(0);
    expect(inv.igst).toBe(0);
    expect(inv.grand_total).toBe(50000);
  });

  it("BUG-017: handles share link generation, customer export, MFA enroll, and unknown POST rejection", async () => {
    const custId = saveCustomer({ name: "Share Export Cust", phone: "+919876500002" });
    const draftId = crypto.randomUUID();
    saveDraft(draftId, {
      id: draftId,
      customer_id: custId,
      items: [
        {
          item_type: "lens",
          description: "Blue Cut Single Vision",
          lens_brand: "Essilor",
          lens_code: "ES-BC-156",
          lens_type: "single vision",
          lens_index: "1.56 Thin",
          coatings: "Blue Cut / Computer",
          tint: "Clear",
          unit_price_paise: 150000,
          qty: 1,
          unit: "pair",
          discount_paise: 0,
          tax_category_id: getStore().taxes[0].id,
        },
      ],
      payments: [],
    });
    const invId = finaliseInvoice(draftId, "key-share-1", []);

    // Share link + public shared-pdf retrieval
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

    const tokenParam = new URL(url).searchParams.get("token")!;
    const sharedPdfRes = await GET(
      new NextRequest(`http://localhost:3001/api/shared-pdf?token=${encodeURIComponent(tokenParam)}`),
      { params: Promise.resolve({ resource: "shared-pdf" }) },
    );
    expect(sharedPdfRes.status).toBe(200);
    expect(sharedPdfRes.headers.get("content-type")).toBe("application/pdf");

    // Customer export JSON & PDF
    const jsonExport = await POST(
      new NextRequest("http://localhost:3001/api/customer-export", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: custId, format: "json" }),
      }),
      { params: Promise.resolve({ resource: "customer-export" }) },
    );
    expect(jsonExport.status).toBe(200);
    const exportedObj = await jsonExport.json();
    expect(exportedObj.customer.id).toBe(custId);

    const pdfExport = await POST(
      new NextRequest("http://localhost:3001/api/customer-export", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: custId, format: "pdf" }),
      }),
      { params: Promise.resolve({ resource: "customer-export" }) },
    );
    expect(pdfExport.status).toBe(200);
    expect(pdfExport.headers.get("content-type")).toBe("application/pdf");

    // MFA enroll
    const mfaRes = await POST(
      new NextRequest("http://localhost:3001/api/mfa-enroll", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ resource: "mfa-enroll" }) },
    );
    expect(mfaRes.status).toBe(200);
    const mfaBody = await mfaRes.json();
    expect(mfaBody.totp.secret).toBeTruthy();
    expect(mfaBody.totp.qr_code).toContain("<svg");

    // Unknown POST endpoint must fail with 400
    const unknownRes = await POST(
      new NextRequest("http://localhost:3001/api/nonexistent-endpoint", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ resource: "nonexistent-endpoint" }) },
    );
    expect(unknownRes.status).toBe(400);
  });
});
