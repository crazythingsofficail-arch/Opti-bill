import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import QRCode from "qrcode";
import * as v from "@/lib/validation";
import { renderInvoicePdf, renderAccessPdf } from "@/lib/pdf";
import {
  createSessionToken,
  verifySessionToken,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginRateLimit,
  createShareToken,
  verifyShareToken,
  generateTotpSecret,
  verifyTotpCode,
} from "@/lib/auth-security";
import {
  isCloudStorageEnabled,
  isTestEnvironment,
  uploadCloudAsset,
} from "@/lib/cloud-store";
import {
  loadStore,
  persistStore,
  getStore,
  saveStore,
  getUploadsDir,
  getStorageBackend,
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
  bookOrder,
  completeOrder,
  enrichOrderWithInvoice,
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
  type LocalStore,
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

function getAuthSession(request: NextRequest) {
  const token = request.cookies.get("opti-activity")?.value;
  return verifySessionToken(token, 8 * 60);
}

function requireOwner(store: LocalStore, userId: string | undefined): void {
  if (!userId) throw new Error("Authentication required");
  if (userId === store.profile.id || userId === "test-admin" || userId === "test-user") {
    if (store.profile.role !== "owner") {
      throw new Error("Owner access required");
    }
    return;
  }
  const member = (store.members || []).find((m) => m.id === userId);
  if (member && member.role !== "owner") {
    throw new Error("Owner access required");
  }
}

async function saveUploadAsset(
  filename: string,
  bytes: Buffer,
  ext: "jpg" | "png" | "webp",
): Promise<string> {
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  if (isCloudStorageEnabled()) {
    await uploadCloudAsset(filename, bytes, mime);
    return `/api/uploads/${filename}`;
  }

  const primaryDir = getUploadsDir();
  try {
    await fs.mkdir(primaryDir, { recursive: true });
    await fs.writeFile(path.join(primaryDir, filename), bytes);
    return `/uploads/${filename}`;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (!isTestEnvironment() && (code === "EROFS" || code === "EACCES" || code === "EPERM")) {
      const tmpDir = path.join(os.tmpdir(), "opti-x-uploads");
      await fs.mkdir(tmpDir, { recursive: true });
      await fs.writeFile(path.join(tmpDir, filename), bytes);
      return `/api/uploads/${filename}`;
    }
    throw err;
  }
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
      const store = await loadStore();
      return success({
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        storageBackend: getStorageBackend(),
        store: {
          readable: true,
          invoicesCount: store.invoices.length,
          customersCount: store.customers.length,
        },
      });
    }

    if (resource === "shared-pdf") {
      const token = request.nextUrl.searchParams.get("token");
      const verified = verifyShareToken(token);
      if (!verified.valid) {
        return NextResponse.json(
          { error: "Share link is invalid or has expired" },
          { status: 401, headers: { "Cache-Control": "private, no-store" } },
        );
      }
      await loadStore();
      const data = await loadPrintDataFromStore(verified.invoiceId);
      if (data.photo?.startsWith("/api/uploads/") && token) {
        data.photo = `${data.photo}?share=${encodeURIComponent(token)}`;
      }
      const buffer = await renderInvoicePdf(data, "a4", "Original for Recipient");
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${data.invoice.invoice_no?.replaceAll("/", "-") || "invoice"}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (!getAuthSession(request).valid) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const store = await loadStore();
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
      const customer = getCustomer(query.id);
      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }

      const prescriptions = getPrescriptionsForCustomer(query.id);
      const invoices = store.invoices.filter((i) => i.customer_id === query.id);
      const orders = store.orders
        .filter((o) => o.customer_id === query.id)
        .map((o) => enrichOrderWithInvoice(o, store));
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
      return success(
        searchInvoices(
          query.q,
          query.page,
          50,
          query.payment,
          query.status,
          query.from,
          query.to,
        ),
      );
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
      const rawOrder = store.orders.find((o) => o.id === query.id);
      if (!rawOrder) throw new Error("Order not found");
      const order = enrichOrderWithInvoice(rawOrder, store);
      const invoices = store.invoices.filter((i) => i.order_id === query.id);
      const invoice = invoices[0];
      const items = invoice ? store.invoice_items.filter((i) => i.invoice_id === invoice.id) : [];
      const payments = invoice ? store.payments.filter((p) => p.invoice_id === invoice.id) : [];
      const prescription = order.prescription_id
        ? store.prescriptions.find((p) => p.id === order.prescription_id)
        : null;
      return success({ order, items, invoices, payments, prescription });
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
    const session = getAuthSession(request);

    if (resource !== "login" && !session.valid) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const store = await loadStore();

    if (resource === "lens-upload") {
      const form = await request.formData();
      const orderId = String(form.get("order_id") || crypto.randomUUID());
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Upload an image file");

      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = validateImageBuffer(bytes);
      const filename = `lens-${crypto.randomUUID()}.${ext}`;
      const publicUrl = await saveUploadAsset(filename, bytes, ext);

      const uploadId = crypto.randomUUID();
      store.uploads.unshift({
        id: uploadId,
        order_id: orderId,
        storage_path: publicUrl,
        file_size: bytes.length,
        created_at: new Date().toISOString(),
      });
      await persistStore(store);
      return success({ id: uploadId, url: publicUrl });
    }

    if (resource === "brand-upload") {
      if (session.valid) requireOwner(store, session.userId);
      const form = await request.formData();
      const kind = form.get("kind");
      if (kind !== "logo" && kind !== "signature") {
        throw new Error("Invalid brand upload kind. Must be logo or signature.");
      }
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Upload an image file");

      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = validateImageBuffer(bytes);
      const filename = `brand-${kind}-${crypto.randomUUID()}.${ext}`;
      const publicUrl = await saveUploadAsset(filename, bytes, ext);

      if (kind === "logo") store.shop.logo_path = publicUrl;
      if (kind === "signature") store.shop.signature_path = publicUrl;
      await persistStore(store);
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
      const expectedPassword =
        process.env.APP_PASSWORD ||
        process.env.ADMIN_PASSWORD ||
        "LFR@26-1204";
      const expectedUser = (
        process.env.APP_USER ||
        process.env.ADMIN_USER ||
        process.env.ADMIN_EMAIL ||
        "admin"
      ).trim();

      const inputLower = p.identifier.toLowerCase();
      const expectedLower = expectedUser.toLowerCase();
      const userMatches =
        inputLower === expectedLower ||
        (!expectedLower.includes("@") &&
          inputLower === `${expectedLower}@opti-x.in`) ||
        (expectedLower === "admin" && inputLower === "admin@opti-x.in") ||
        (expectedLower === "admin@opti-x.in" && inputLower === "admin");

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

      if (!userMatches || !passwordMatches) {
        recordFailedLogin(clientIp);
        throw new Error("Unable to log in. Check your username and password.");
      }

      resetLoginRateLimit(clientIp);
      const token = createSessionToken(store.profile.id);
      const response = success({ ok: true });
      response.cookies.set("opti-activity", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
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
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = v.setupSchema.parse(body);
      store.profile.full_name = p.full_name;
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
        invoice_recipient_threshold_paise: p.invoice_recipient_threshold_paise,
      };
      await persistStore(store);
      return success({ id: store.shop.id });
    }

    if (resource === "customers") {
      const raw = z
        .object({ id: v.uuid.optional(), data: v.customerSchema })
        .parse(body);
      const customerId = saveCustomer(raw.data, raw.id);
      await persistStore();
      return success({ id: customerId });
    }

    if (resource === "prescriptions") {
      const raw = z
        .object({ id: v.uuid.optional(), data: v.prescriptionSchema })
        .parse(body);
      const rxId = savePrescription(raw.data, raw.id);
      await persistStore();
      return success({ id: rxId });
    }

    if (resource === "lens-remove") {
      const p = z.object({ id: z.string() }).parse(body);
      removeLensUpload(p.id);
      await persistStore();
      return success({ ok: true });
    }

    if (resource === "brand-remove") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = z.object({ kind: z.enum(["logo", "signature"]) }).parse(body);
      removeBrandImage(p.kind);
      await persistStore();
      return success({ ok: true });
    }

    if (resource === "cancel") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = z
        .object({
          id: z.string(),
          reason: z.string().default("Cancelled"),
          restock: z.boolean().optional(),
        })
        .parse(body);
      cancelInvoice(p.id, p.reason, p.restock);
      await persistStore();
      return success({ ok: true });
    }

    if (resource === "credit") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = z
        .object({
          id: z.string(),
          reason: z.string().default("Credit note issued"),
          restock: z.boolean().optional(),
        })
        .parse(body);
      const cnId = creditInvoice(p.id, p.reason, p.restock);
      await persistStore();
      return success({ ok: true, id: cnId });
    }

    if (resource === "reverse") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = z
        .object({
          id: z.string(),
          reason: z.string().default("Payment refunded"),
        })
        .parse(body);
      reversePayment(p.id, p.reason);
      await persistStore();
      return success({ ok: true });
    }

    if (resource === "frames") {
      const raw = z
        .object({ id: v.uuid.optional(), data: v.frameSchema })
        .parse(body);
      const frameId = saveFrame(raw.data, raw.id);
      await persistStore();
      return success({ id: frameId });
    }

    if (resource === "lenses") {
      const raw = z
        .object({ id: v.uuid.optional(), data: v.lensSchema })
        .parse(body);
      const lensId = saveLens(raw.data, raw.id);
      await persistStore();
      return success({ id: lensId });
    }

    if (resource === "lens-delete") {
      const raw = z.object({ id: v.uuid }).parse(body);
      deleteLens(raw.id);
      await persistStore();
      return success({ ok: true });
    }

    if (resource === "taxes") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const raw = z
        .object({ id: v.uuid.optional(), data: v.taxSchema })
        .parse(body);
      const taxId = saveTaxCategory(raw.data, raw.id);
      await persistStore();
      return success({ id: taxId });
    }

    if (resource === "invite") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = z
        .object({
          full_name: z.string(),
          email: z.string().email(),
          role: z.enum(["owner", "staff", "optometrist"]),
        })
        .parse(body);
      const member = saveMember(p);
      await persistStore();
      return success({ ok: true, id: member.id });
    }

    if (resource === "members") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = z
        .object({
          id: z.string(),
          full_name: z.string().optional(),
          role: z.enum(["owner", "staff", "optometrist"]).optional(),
          is_active: z.boolean().optional(),
        })
        .parse(body);
      const member = saveMember(p, p.id);
      await persistStore();
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
      await persistStore();
      return success({ id: req.id });
    }

    if (resource === "resolve-request") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = z
        .object({
          id: z.string(),
          status: z.enum(["completed", "rejected"]),
          details: z.string().optional(),
        })
        .parse(body);
      resolveDataRequest(p.id, p.status, p.details);
      await persistStore();
      return success({ ok: true });
    }

    if (resource === "erase") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = z.object({ id: z.string() }).parse(body);
      eraseCustomerData(p.id);
      await persistStore();
      return success({ ok: true });
    }

    if (resource === "draft") {
      const p = v.draftSchema.parse(body);
      const res = saveDraft(p.id, p);
      await persistStore();
      return success(res);
    }

    if (resource === "finalise") {
      const p = v.finaliseSchema.parse(body);
      const invId = finaliseInvoice(p.id, p.key, p.payments, p.is_booking);
      await persistStore();
      return success({ id: invId });
    }

    if (resource === "book-order") {
      const p = v.bookOrderSchema.parse(body);
      const result = bookOrder(p);
      await persistStore();
      return success(result);
    }

    if (resource === "complete-order") {
      const p = v.completeOrderSchema.parse(body);
      const result = completeOrder(p);
      await persistStore();
      return success(result);
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
      await persistStore(store);
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
        await persistStore(store);
      }
      return success({ ok: true });
    }

    if (resource === "settings") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = v.settingsSchema.parse(body);
      store.shop = {
        ...store.shop,
        ...p,
      };
      await persistStore(store);
      return success({ ok: true });
    }

    if (resource === "share") {
      const p = z.object({ id: v.uuid }).parse(body);
      const inv = store.invoices.find((i) => i.id === p.id);
      if (!inv) throw new Error("Finalised invoice not found");
      const token = createShareToken(p.id, 3600);
      const origin = process.env.APP_URL || request.nextUrl.origin;
      return success({
        url: `${origin}/api/shared-pdf?token=${encodeURIComponent(token)}`,
      });
    }

    if (resource === "customer-export") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = z
        .object({ id: v.uuid, format: z.enum(["json", "pdf"]) })
        .parse(body);
      const customer = getCustomer(p.id);
      if (!customer) throw new Error("Customer not found");
      const prescriptions = getPrescriptionsForCustomer(p.id);
      const invoices = store.invoices.filter((i) => i.customer_id === p.id);
      const orders = store.orders.filter((o) => o.customer_id === p.id);
      const exportPayload = {
        exported_at: new Date().toISOString(),
        shop: { name: store.shop.name, email: store.shop.email },
        customer,
        prescriptions,
        invoices,
        orders,
      };
      if (p.format === "json") {
        return new Response(JSON.stringify(exportPayload, null, 2), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": 'attachment; filename="customer-access.json"',
            "Cache-Control": "private, no-store",
          },
        });
      }
      const pdfBuffer = await renderAccessPdf(exportPayload);
      return new Response(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="customer-access.pdf"',
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (resource === "mfa-enroll") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const secret = generateTotpSecret();
      const factorId = crypto.randomUUID();
      const label = encodeURIComponent(`${store.shop.name}:${store.shop.email}`);
      const issuer = encodeURIComponent(store.shop.name || "Opti-X");
      const otpauth = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}`;
      const qrSvg = await QRCode.toString(otpauth, { type: "svg", margin: 1 });
      store.mfa = {
        secret: store.mfa?.secret || null,
        pendingSecret: secret,
        enabled: store.mfa?.enabled || false,
      };
      await persistStore(store);
      return success({ id: factorId, totp: { qr_code: qrSvg, secret } });
    }

    if (resource === "mfa-verify") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = z
        .object({ factorId: z.string().optional(), code: z.string().min(6).max(8) })
        .parse(body);
      const secret = store.mfa?.pendingSecret || store.mfa?.secret;
      if (!secret || !verifyTotpCode(secret, p.code)) {
        throw new Error("Invalid 6-digit authenticator code");
      }
      store.mfa = { secret, pendingSecret: null, enabled: true };
      await persistStore(store);
      return success({ verified: true });
    }

    if (resource === "mfa-require") {
      requireOwner(store, session.valid ? session.userId : undefined);
      const p = z.object({ required: z.boolean() }).parse(body);
      if (p.required && !store.mfa?.enabled) {
        throw new Error("Verify an authenticator before enabling owner MFA requirement");
      }
      store.shop.require_owner_mfa = p.required;
      await persistStore(store);
      return success({ required: p.required });
    }

    if (resource === "export") {
      requireOwner(store, session.valid ? session.userId : undefined);
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

    throw new Error("Unknown endpoint");
  } catch (error) {
    return fail(error);
  }
}
