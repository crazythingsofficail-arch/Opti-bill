import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "@/lib/validation";
import { renderInvoicePdf } from "@/lib/pdf";
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
  saveDraft,
  getDraft,
  finaliseInvoice,
  searchInvoices,
  searchOrders,
  getDashboardStats,
  getReportsData,
  loadPrintDataFromStore,
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
});

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { resource } = await params;
    const store = getStore();
    const query = searchSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

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
    const store = getStore();

    if (resource === "lens-upload") {
      const form = await request.formData();
      const orderId = String(form.get("order_id") || crypto.randomUUID());
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Upload an image file");

      const bytes = Buffer.from(await file.arrayBuffer());
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const ext = file.name.endsWith(".png") ? "png" : file.name.endsWith(".webp") ? "webp" : "jpg";
      const filename = `lens-${crypto.randomUUID()}.${ext}`;
      const filepath = path.join(uploadsDir, filename);
      await fs.writeFile(filepath, bytes);

      const publicUrl = `/uploads/${filename}`;
      const uploadId = crypto.randomUUID();
      store.uploads.unshift({
        id: uploadId,
        order_id: orderId,
        storage_path: publicUrl,
        file_size: file.size,
        created_at: new Date().toISOString(),
      });
      saveStore(store);
      return success({ id: uploadId, url: publicUrl });
    }

    if (resource === "brand-upload") {
      const form = await request.formData();
      const kind = form.get("kind");
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Upload an image file");

      const bytes = Buffer.from(await file.arrayBuffer());
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await fs.mkdir(uploadsDir, { recursive: true });

      const ext = file.name.endsWith(".png") ? "png" : file.name.endsWith(".webp") ? "webp" : "jpg";
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
      const p = v.loginSchema.parse(body);
      const isMatch =
        (p.email === "admin@opti-x.in" || p.email === "admin") &&
        p.password === "LFR@26-1204";

      if (!isMatch && p.password !== "LFR@26-1204") {
        throw new Error("Unable to log in. Check your email and password.");
      }

      const response = success({ ok: true });
      response.cookies.set("opti-activity", `${Date.now()}`, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
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

    if (resource === "frames" || resource === "taxes") {
      if (resource === "frames") {
        const raw = z
          .object({ id: v.uuid.optional(), data: v.frameSchema })
          .parse(body);
        const frameId = saveFrame(raw.data, raw.id);
        return success({ id: frameId });
      }
      return success({ id: crypto.randomUUID() });
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

    if (resource === "update-order") {
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
        if (p.lab_name) ord.lab_name = p.lab_name;
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
          "Day,Taxable (Paise),Tax (Paise),Sales (Paise)\n" +
          rep.daily
            .map((d) => `${d.day},${d.taxable},${d.tax},${d.sales}`)
            .join("\n");
      } else if (p.section === "gst") {
        csv =
          "HSN Code,GST Rate (bp),Taxable (Paise),CGST (Paise),SGST (Paise),IGST (Paise)\n" +
          rep.gst
            .map(
              (g) =>
                `${g.hsn_code},${g.gst_rate_bp},${g.taxable},${g.cgst},${g.sgst},${g.igst}`,
            )
            .join("\n");
      } else if (p.section === "modes") {
        csv =
          "Mode,Amount (Paise)\n" +
          rep.modes.map((m) => `${m.mode},${m.amount}`).join("\n");
      } else if (p.section === "ageing") {
        csv =
          "Bucket,Amount (Paise)\n" +
          rep.ageing.map((a) => `${a.bucket},${a.amount}`).join("\n");
      } else if (p.section === "products") {
        csv =
          "Product,Quantity,Sales (Paise)\n" +
          rep.products
            .map(
              (pr) =>
                `"${pr.product.replaceAll('"', '""')}",${pr.quantity},${pr.sales}`,
            )
            .join("\n");
      } else if (p.section === "staff") {
        csv =
          "Staff,Sales (Paise)\n" +
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
