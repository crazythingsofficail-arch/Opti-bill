import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import * as v from "@/lib/validation";
import { renderInvoicePdf } from "@/lib/pdf";
import {
  createSessionToken,
  verifySessionToken,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginRateLimit,
} from "@/lib/auth-security";
import {
  getStore,
  saveStore,
  saveCustomer,
  searchCustomers,
  getCustomer,
  savePrescription,
  getPrescriptionsForCustomer,
  saveFrame,
  searchFrames,
  saveLens,
  searchLenses,
  deleteLens,
  saveDraft,
  getDraft,
  finaliseInvoice,
  searchInvoices,
  searchOrders,
  getDashboardStats,
  getReportsData,
  loadPrintDataFromStore,
  saveTaxCategory,
  cancelInvoice,
  creditInvoice,
  reversePayment,
  removeLensUpload,
  removeBrandImage,
  getMembers,
  saveMember,
  getDataRequests,
  saveDataRequest,
  resolveDataRequest,
  eraseCustomerData,
  DEFAULT_SHOP,
  DEFAULT_PROFILE,
} from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ resource: string }> };

function success(data: unknown) {
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

function fail(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  }
  const message = error instanceof Error ? error.message : "Request failed";
  return NextResponse.json({ error: message }, { status: 400 });
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

function validateImageBuffer(bytes: Buffer): "jpg" | "png" | "webp" {
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds 10MB limit");
  }
  if (bytes.length < 12) {
    throw new Error("Invalid image format. Only JPEG, PNG, and WebP images are allowed.");
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  // WebP: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  throw new Error("Invalid image format. Only JPEG, PNG, and WebP images are allowed.");
}

function checkAuth(request: NextRequest): boolean {
  const token = request.cookies.get("opti-activity")?.value;
  return verifySessionToken(token, 8 * 60).valid;
}

const searchSchema = z.object({
  q: z.string().max(100).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  id: z.string().optional(),
  customer: z.string().optional(),
  status: z.string().max(40).optional(),
  payment: z.string().max(40).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  filter: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { resource } = await params;

    if (resource === "health") {
      const store = getStore();
      return success({
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        store: {
          readable: true,
          invoicesCount: store.invoices.length,
          customersCount: store.customers.length,
        },
      });
    }

    if (!checkAuth(request)) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const store = getStore();
    const query = searchSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    if (resource === "taxes") {
      const page = query.page || 1;
      const limit = 50;
      const start = (page - 1) * limit;
      return success({
        rows: store.taxes.slice(start, start + limit),
        count: store.taxes.length,
        page,
      });
    }

    if (resource === "members") {
      return success({ rows: getMembers() });
    }

    if (resource === "requests") {
      return success({ rows: getDataRequests() });
    }

    if (resource === "context") {
      return success({ profile: store.profile, shop: store.shop });
    }

    if (resource === "active-taxes") {
      return success({ rows: store.taxes });
    }

    if (resource === "dashboard") {
      return success(getDashboardStats());
    }

    if (resource === "reports") {
      return success(getReportsData(query.from, query.to));
    }

    if (resource === "customers") {
      if (query.id) {
        const cust = getCustomer(query.id);
        return success({ rows: cust ? [cust] : [], count: cust ? 1 : 0, page: 1 });
      }
      return success(searchCustomers(query.q, query.page, 50, query.filter));
    }

    if (resource === "customer-detail") {
      if (!query.id) throw new Error("Customer ID required");
      const customer = getCustomer(query.id) || {
        id: query.id,
        shop_id: store.shop.id,
        name: "Customer",
        phone: "+919876543210",
        alt_phone: null,
        gender: "other",
        dob: null,
        age_years: 30,
        email: null,
        address: null,
        city: null,
        state_code: store.shop.state_code,
        gstin: null,
        notes: null,
        consent_given: true,
        consent_at: new Date().toISOString(),
        consent_version: "v1",
        guardian_name: null,
        guardian_phone: null,
        guardian_consent: false,
        guardian_verification: null,
        created_at: new Date().toISOString(),
        anonymised_at: null,
      };

      const prescriptions = getPrescriptionsForCustomer(query.id);
      const invoices = store.invoices.filter((i) => i.customer_id === query.id);
      const orders = store.orders.filter((o) => o.customer_id === query.id);
      return success({ customer, prescriptions, invoices, orders });
    }

    if (resource === "prescriptions") {
      const list = query.customer
        ? getPrescriptionsForCustomer(query.customer)
        : store.prescriptions;
      return success({ rows: list, count: list.length, page: query.page });
    }

    if (resource === "frames" || resource === "inventory") {
      return success(searchFrames(query.q, query.page));
    }

    if (resource === "lenses") {
      return success(
        searchLenses(query.q, query.page, query.limit || 50),
      );
    }

    if (resource === "invoices") {
      return success(searchInvoices(query.q, query.page, 50, query.payment));
    }

    if (resource === "invoice-detail") {
      if (!query.id) throw new Error("Invoice ID required");
      const invoice = store.invoices.find((i) => i.id === query.id);
      if (!invoice) throw new Error("Invoice not found");
      const items = store.invoice_items.filter((i) => i.invoice_id === query.id);
      const payments = store.payments.filter((p) => p.invoice_id === query.id);
      const customer = store.customers.find((c) => c.id === invoice.customer_id);
      return success({
        invoice,
        items,
        payments,
        customerPhone: customer?.phone || null,
      });
    }

    if (resource === "orders") {
      return success(searchOrders(query.q, query.page));
    }

    if (resource === "order-detail") {
      if (!query.id) throw new Error("Order ID required");
      const order = store.orders.find((o) => o.id === query.id);
      if (!order) throw new Error("Order not found");
      const invoices = store.invoices.filter((i) => i.order_id === query.id);
      const invoice = invoices[0];
      const items = invoice ? store.invoice_items.filter((i) => i.invoice_id === invoice.id) : [];
      const prescription = order.prescription_id
        ? store.prescriptions.find((p) => p.id === order.prescription_id)
        : null;
      return success({ order, items, invoices, prescription });
    }

    if (resource === "draft") {
      if (!query.id) throw new Error("Draft ID required");
      const draft = getDraft(query.id);
      if (draft) {
        const customer = getCustomer(draft.customer_id);
        return success({
          invoice: {
            id: query.id,
            shop_id: store.shop.id,
            status: "draft",
            draft_version: draft.version || 1,
            place_of_supply_state_code: draft.place_of_supply_state_code || store.shop.state_code,
            overall_discount_paise: draft.overall_discount_paise || 0,
            draft_payments: draft.payments || [],
          },
          order: {
            id: draft.order_id || crypto.randomUUID(),
            shop_id: store.shop.id,
            prescription_id: draft.prescription_id || null,
            promised_date: draft.promised_date || null,
            notes: draft.notes || "",
          },
          items: draft.items || [],
          customer: customer || { id: draft.customer_id, name: "Customer", phone: "" },
        });
      }
      return success({
        invoice: {
          id: query.id,
          shop_id: store.shop.id,
          status: "draft",
          draft_version: 0,
          place_of_supply_state_code: store.shop.state_code,
          overall_discount_paise: 0,
          draft_payments: [],
        },
        order: { id: crypto.randomUUID(), shop_id: store.shop.id },
        items: [],
        customer: { id: crypto.randomUUID(), name: "Customer", phone: "" },
      });
    }

    if (resource === "lens-photo") {
      if (!query.id) throw new Error("Order ID required");
      const upload = store.uploads.find((u) => u.order_id === query.id);
      return success({ url: upload ? upload.storage_path : null });
    }

    if (resource === "pdf") {
      if (!query.id) throw new Error("Invoice ID required");
      const layout = z
        .enum(["a4", "thermal", "job", "prescription"])
        .parse(request.nextUrl.searchParams.get("layout") || "a4");
      const copy = z
        .enum(["Original for Recipient", "Duplicate", "Triplicate"])
        .parse(
          request.nextUrl.searchParams.get("copy") || "Original for Recipient",
        );
      const data = await loadPrintDataFromStore(query.id);
      const buffer = await renderInvoicePdf(data, layout, copy);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${data.invoice.invoice_no?.replaceAll("/", "-") || "invoice"}-${layout}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    throw new Error("Unknown endpoint");
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { resource } = await params;

    if (resource !== "login" && !checkAuth(request)) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const store = getStore();

    if (resource === "lens-upload") {
      const form = await request.formData();
      const orderId = String(form.get("order_id") || crypto.randomUUID());
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Upload an image file");

      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = validateImageBuffer(bytes);

      const uploadsDir = process.env.OPTI_UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const filename = `lens-${crypto.randomUUID()}.${ext}`;
      const filepath = path.join(uploadsDir, filename);
      await fs.writeFile(filepath, bytes);

      const publicUrl = `/uploads/${filename}`;
      const uploadId = crypto.randomUUID();
      store.uploads.unshift({
        id: uploadId,
        order_id: orderId,
        storage_path: publicUrl,
        file_size: bytes.length,
        created_at: new Date().toISOString(),
      });
      saveStore(store);
      return success({ id: uploadId, url: publicUrl });
    }

    if (resource === "brand-upload") {
      const form = await request.formData();
      const kind = form.get("kind");
      if (kind !== "logo" && kind !== "signature") {
        throw new Error("Invalid brand upload kind. Must be logo or signature.");
      }
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Upload an image file");

      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = validateImageBuffer(bytes);

      const uploadsDir = process.env.OPTI_UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const filename = `brand-${kind}-${crypto.randomUUID()}.${ext}`;
      const filepath = path.join(uploadsDir, filename);
      await fs.writeFile(filepath, bytes);

      const publicUrl = `/uploads/${filename}`;
      if (kind === "logo") store.shop.logo_path = publicUrl;
      if (kind === "signature") store.shop.signature_path = publicUrl;
      saveStore(store);
      return success({ ok: true, url: publicUrl });
    }

    const body: unknown = await request.json();

    if (resource === "login") {
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        request.headers.get("x-real-ip") ||
        "127.0.0.1";

      const rateCheck = checkLoginRateLimit(clientIp);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          { error: "Too many failed login attempts. Please try again in 15 minutes." },
          {
            status: 429,
            headers: {
              "Retry-After": String(rateCheck.retryAfterSeconds || 900),
              "Cache-Control": "private, no-store",
            },
          },
        );
      }

      const p = v.loginSchema.parse(body);
      const expectedPassword = process.env.ADMIN_PASSWORD || "LFR@26-1204";
      const expectedEmail = process.env.ADMIN_EMAIL || "admin@opti-x.in";

      const emailMatches =
        p.email.toLowerCase() === expectedEmail.toLowerCase() ||
        p.email.toLowerCase() === "admin";

      let passwordMatches = false;
      try {
        const bufA = Buffer.from(p.password);
        const bufB = Buffer.from(expectedPassword);
        if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
          passwordMatches = true;
        }
      } catch {
        passwordMatches = false;
      }

      if (!emailMatches || !passwordMatches) {
        recordFailedLogin(clientIp);
        throw new Error("Unable to log in. Check your email and password.");
      }

      resetLoginRateLimit(clientIp);
      const token = createSessionToken(store.profile.id);
      const response = success({ ok: true });
      response.cookies.set("opti-activity", token, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        maxAge: 8 * 3600,
      });
      return response;
    }

    if (resource === "logout") {
      const response = success({ ok: true });
      response.cookies.delete("opti-activity");
      return response;
    }

    if (resource === "setup") {
      const p = v.setupSchema.parse(body);
      store.shop = {
        ...store.shop,
        name: p.name,
        legal_name: p.legal_name,
        gstin: p.gstin || null,
        address: p.address,
        city: p.city,
        state: p.state,
        state_code: p.state_code,
        pincode: p.pincode,
        phone: p.phone,
        email: p.email,
        gst_scheme: p.gst_scheme,
        invoice_prefix: p.invoice_prefix,
      };
      saveStore(store);
      return success({ id: store.shop.id });
    }

    if (resource === "customers") {
      const raw = z
        .object({ id: v.uuid.optional(), data: v.customerSchema })
        .parse(body);
      const customerId = saveCustomer(raw.data, raw.id);
      return success({ id: customerId });
    }

    if (resource === "prescriptions") {
      const raw = z
        .object({ id: v.uuid.optional(), data: v.prescriptionSchema })
        .parse(body);
      const rxId = savePrescription(raw.data, raw.id);
      return success({ id: rxId });
    }

    if (resource === "lens-remove") {
      const p = z.object({ id: z.string() }).parse(body);
      removeLensUpload(p.id);
      return success({ ok: true });
    }

    if (resource === "brand-remove") {
      const p = z.object({ kind: z.enum(["logo", "signature"]) }).parse(body);
      removeBrandImage(p.kind);
      return success({ ok: true });
    }

    if (resource === "cancel") {
      const p = z
        .object({
          id: z.string(),
          reason: z.string().default("Cancelled"),
          restock: z.boolean().optional(),
        })
        .parse(body);
      cancelInvoice(p.id, p.reason, p.restock);
      return success({ ok: true });
    }

    if (resource === "credit") {
      const p = z
        .object({
          id: z.string(),
          reason: z.string().default("Credit note issued"),
          restock: z.boolean().optional(),
        })
        .parse(body);
      const cnId = creditInvoice(p.id, p.reason, p.restock);
      return success({ ok: true, id: cnId });
    }

    if (resource === "reverse") {
      const p = z
        .object({
          id: z.string(),
          reason: z.string().default("Payment refunded"),
        })
        .parse(body);
      reversePayment(p.id, p.reason);
      return success({ ok: true });
    }

    if (resource === "frames") {
      const raw = z
        .object({ id: v.uuid.optional(), data: v.frameSchema })
        .parse(body);
      const frameId = saveFrame(raw.data, raw.id);
      return success({ id: frameId });
    }

    if (resource === "lenses") {
      const raw = z
        .object({ id: v.uuid.optional(), data: v.lensSchema })
        .parse(body);
      const lensId = saveLens(raw.data, raw.id);
      return success({ id: lensId });
    }

    if (resource === "lens-delete") {
      const raw = z.object({ id: v.uuid }).parse(body);
      deleteLens(raw.id);
      return success({ ok: true });
    }

    if (resource === "taxes") {
      const raw = z
        .object({ id: v.uuid.optional(), data: z.any() })
        .parse(body);
      const taxId = saveTaxCategory(raw.data, raw.id);
      return success({ id: taxId });
    }

    if (resource === "invite") {
      const p = z
        .object({
          full_name: z.string(),
          email: z.string().email(),
          role: z.enum(["owner", "staff", "optometrist"]),
        })
        .parse(body);
      const member = saveMember(p);
      return success({ ok: true, id: member.id });
    }

    if (resource === "members") {
      const p = z
        .object({
          id: z.string(),
          full_name: z.string().optional(),
          role: z.enum(["owner", "staff", "optometrist"]).optional(),
          is_active: z.boolean().optional(),
        })
        .parse(body);
      const member = saveMember(p, p.id);
      return success({ ok: true, id: member.id });
    }

    if (resource === "requests") {
      const p = z
        .object({
          customer_id: z.string(),
          type: z.enum(["access", "correction", "erasure"]),
          details: z.string(),
        })
        .parse(body);
      const req = saveDataRequest(p);
      return success({ id: req.id });
    }

    if (resource === "resolve-request") {
      const p = z
        .object({
          id: z.string(),
          status: z.enum(["completed", "rejected"]),
          details: z.string().optional(),
        })
        .parse(body);
      resolveDataRequest(p.id, p.status, p.details);
      return success({ ok: true });
    }

    if (resource === "erase") {
      const p = z.object({ id: z.string() }).parse(body);
      eraseCustomerData(p.id);
      return success({ ok: true });
    }

    if (resource === "draft") {
      const p = v.draftSchema.parse(body);
      const res = saveDraft(p.id, p);
      return success(res);
    }

    if (resource === "finalise") {
      const p = v.finaliseSchema.parse(body);
      const invId = finaliseInvoice(p.id, p.key, p.payments);
      return success({ id: invId });
    }

    if (resource === "payment") {
      const p = v.paymentSchema.parse(body);
      const paymentId = crypto.randomUUID();
      store.payments.push({
        id: paymentId,
        shop_id: store.shop.id,
        invoice_id: p.invoice_id,
        amount_paise: p.amount_paise,
        mode: p.mode,
        reference_no: p.reference_no,
        paid_at: new Date().toISOString(),
      });

      const inv = store.invoices.find((i) => i.id === p.invoice_id);
      if (inv) {
        inv.amount_paid += p.amount_paise;
        inv.balance_due = Math.max(0, inv.grand_total - inv.amount_paid);
        inv.payment_status =
          inv.balance_due <= 0 ? "paid" : inv.amount_paid > 0 ? "partial" : "unpaid";
      }
      saveStore(store);
      return success({ id: paymentId });
    }

    if (resource === "update-order" || resource === "orders") {
      const p = z
        .object({
          id: v.uuid,
          status: z.enum([
            "Ordered",
            "Sent to lab",
            "Received from lab",
            "Ready",
            "Delivered",
          ]),
          lab_name: z.string().optional(),
          promised_date: z.string().nullable().optional(),
        })
        .parse(body);
      const ord = store.orders.find((o) => o.id === p.id);
      if (ord) {
        ord.status = p.status;
        if (p.lab_name !== undefined) ord.lab_name = p.lab_name;
        if (p.promised_date !== undefined) ord.promised_date = p.promised_date;
        saveStore(store);
      }
      return success({ ok: true });
    }

    if (resource === "settings") {
      const p = v.settingsSchema.parse(body);
      store.shop = {
        ...store.shop,
        ...p,
      };
      saveStore(store);
      return success({ ok: true });
    }

    if (resource === "export") {
      const p = z
        .object({
          from: z.string().optional(),
          to: z.string().optional(),
          section: z.string(),
        })
        .parse(body);

      const rep = getReportsData(p.from, p.to);
      let csv = "";
      if (p.section === "daily") {
        csv =
          '"Day","Taxable (Paise)","Tax (Paise)","Sales (Paise)"\n' +
          rep.daily
            .map((d) => `"${d.day}",${d.taxable},${d.tax},${d.sales}`)
            .join("\n");
      } else if (p.section === "gst") {
        csv =
          '"HSN Code","GST Rate (bp)","Taxable (Paise)","CGST (Paise)","SGST (Paise)","IGST (Paise)"\n' +
          rep.gst
            .map(
              (g) =>
                `"${g.hsn_code}",${g.gst_rate_bp},${g.taxable},${g.cgst},${g.sgst},${g.igst}`,
            )
            .join("\n");
      } else if (p.section === "modes") {
        csv =
          '"Mode","Amount (Paise)"\n' +
          rep.modes.map((m) => `"${m.mode.replaceAll('"', '""')}",${m.amount}`).join("\n");
      } else if (p.section === "ageing") {
        csv =
          '"Bucket","Amount (Paise)"\n' +
          rep.ageing.map((a) => `"${a.bucket}",${a.amount}`).join("\n");
      } else if (p.section === "products") {
        csv =
          '"Product","Quantity","Sales (Paise)"\n' +
          rep.products
            .map(
              (pr) =>
                `"${pr.product.replaceAll('"', '""')}",${pr.quantity},${pr.sales}`,
            )
            .join("\n");
      } else if (p.section === "staff") {
        csv =
          '"Staff","Sales (Paise)"\n' +
          rep.staff
            .map(
              (st) =>
                `"${st.full_name.replaceAll('"', '""')}",${st.sales}`,
            )
            .join("\n");
      }

      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="opti-x-${p.section}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    return success({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
