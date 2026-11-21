import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import type {
  Customer,
  Prescription,
  Frame,
  TaxCategory,
  Invoice,
  InvoiceItem,
  Order,
  Payment,
  Shop,
  Profile,
  PrintData,
  Report,
} from "./types";
import { calculateInvoice, financialYear, invoiceNumber } from "./money";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

export const DEFAULT_SHOP: Shop = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Opti-X Optical Care",
  legal_name: "Opti-X Optical Care Pvt Ltd",
  gstin: "29AAAAA0000A1Z5",
  address: "100 Feet Ring Road, Indiranagar",
  city: "Bengaluru",
  state: "Karnataka",
  state_code: "29",
  pincode: "560038",
  phone: "+919876543210",
  email: "admin@opti-x.in",
  gst_scheme: "regular",
  invoice_prefix: "OX",
  terms_text: "Standard 1-year warranty on frames. Lens coating warranty 6 months.",
  warranty_text: "Frames and lenses covered against manufacturing defects.",
  return_policy_text: "Prescription lenses are custom-made and non-refundable.",
  composition_declaration: "",
  reverse_charge_text: "",
  privacy_text: "We protect customer and clinical eye examination data.",
  privacy_version: "v1",
  privacy_updated_at: new Date().toISOString(),
  terms_of_use_text: "Terms of service for Opti-X Optical.",
  consent_text: "I hereby consent to eye examination and prescription record retention.",
  grievance_name: "Grievance Officer",
  grievance_email: "grievance@opti-x.in",
  retention_months: 60,
  clinical_retention_months: 24,
  hsn_digits: 4,
  invoice_recipient_threshold_paise: 5000000,
  upi_id: "optix@upi",
  bank_details: "HDFC Bank, A/C: 50200012345678, IFSC: HDFC0001234",
  einvoice_enabled: false,
  require_owner_mfa: false,
  logo_path: null,
  signature_path: null,
};

export const DEFAULT_PROFILE: Profile = {
  id: "a0ac6e98-d33b-45ec-bfad-1f96437b34db",
  shop_id: DEFAULT_SHOP.id,
  full_name: "Admin",
  role: "owner",
  is_active: true,
};

export interface LocalStore {
  shop: Shop;
  profile: Profile;
  customers: Customer[];
  prescriptions: Prescription[];
  frames: Frame[];
  taxes: TaxCategory[];
  invoices: Invoice[];
  invoice_items: InvoiceItem[];
  orders: Order[];
  payments: Payment[];
  uploads: Array<{ id: string; order_id: string; storage_path: string; file_size: number; created_at: string }>;
  drafts: Record<string, any>;
  nextInvoiceSeq: number;
}

function initialStore(): LocalStore {
  return {
    shop: DEFAULT_SHOP,
    profile: DEFAULT_PROFILE,
    customers: [],
    prescriptions: [],
    frames: [],
    taxes: [
      {
        id: "10000000-0000-4000-8000-000000000010",
        name: "GST 12% (Spectacles & Frames)",
        hsn_code: "9003",
        gst_rate_bp: 1200,
        effective_from: "2020-01-01",
        is_active: true,
      },
      {
        id: "10000000-0000-4000-8000-000000000011",
        name: "GST 18% (Contact Lenses & Care)",
        hsn_code: "9001",
        gst_rate_bp: 1800,
        effective_from: "2020-01-01",
        is_active: true,
      },
      {
        id: "10000000-0000-4000-8000-000000000012",
        name: "GST 0% (Clinical Eye Test)",
        hsn_code: "9993",
        gst_rate_bp: 0,
        effective_from: "2020-01-01",
        is_active: true,
      },
    ],
    invoices: [],
    invoice_items: [],
    orders: [],
    payments: [],
    uploads: [],
    drafts: {},
    nextInvoiceSeq: 1,
  };
}

let memoryStore: LocalStore | null = null;

export function getStore(): LocalStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf8");
      memoryStore = JSON.parse(raw);
      if (memoryStore) {
        if (!memoryStore.shop) memoryStore.shop = DEFAULT_SHOP;
        if (!memoryStore.profile) memoryStore.profile = DEFAULT_PROFILE;
        if (!memoryStore.customers) memoryStore.customers = [];
        if (!memoryStore.prescriptions) memoryStore.prescriptions = [];
        if (!memoryStore.frames) memoryStore.frames = [];
        if (!memoryStore.taxes || !memoryStore.taxes.length) memoryStore.taxes = initialStore().taxes;
        if (!memoryStore.invoices) memoryStore.invoices = [];
        if (!memoryStore.invoice_items) memoryStore.invoice_items = [];
        if (!memoryStore.orders) memoryStore.orders = [];
        if (!memoryStore.payments) memoryStore.payments = [];
        if (!memoryStore.uploads) memoryStore.uploads = [];
        if (!memoryStore.drafts) memoryStore.drafts = {};
        if (!memoryStore.nextInvoiceSeq) memoryStore.nextInvoiceSeq = 1;
        return memoryStore;
      }
    }
  } catch (err) {
    console.warn("Using initial store:", err);
  }
  memoryStore = initialStore();
  saveStore(memoryStore);
  return memoryStore;
}

export function saveStore(store: LocalStore): void {
  memoryStore = store;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write store.json:", err);
  }
}

// Customers
export function saveCustomer(data: any, id?: string | null): string {
  const store = getStore();
  const customerId = id || crypto.randomUUID();
  const existingIndex = store.customers.findIndex((c) => c.id === customerId);
  const now = new Date().toISOString();

  const customerRecord: Customer = {
    id: customerId,
    shop_id: store.shop.id,
    name: data.name || "Customer",
    phone: data.phone || null,
    alt_phone: data.alt_phone || null,
    gender: data.gender || "undisclosed",
    dob: data.dob || null,
    age_years: data.age_years ?? null,
    email: data.email || null,
    address: data.address || null,
    city: data.city || null,
    state_code: data.state_code || store.shop.state_code,
    gstin: data.gstin || null,
    notes: data.notes || null,
    consent_given: true,
    consent_at: now,
    consent_version: store.shop.privacy_version || "v1",
    guardian_name: data.guardian_name || null,
    guardian_phone: data.guardian_phone || null,
    guardian_consent: Boolean(data.guardian_consent),
    guardian_verification: data.guardian_verification || null,
    created_at: existingIndex >= 0 ? store.customers[existingIndex].created_at : now,
    anonymised_at: null,
  };

  if (existingIndex >= 0) {
    store.customers[existingIndex] = customerRecord;
  } else {
    store.customers.unshift(customerRecord);
  }
  saveStore(store);
  return customerId;
}

export function getCustomer(id: string): Customer | undefined {
  const store = getStore();
  return store.customers.find((c) => c.id === id);
}

export function searchCustomers(q: string, page = 1, limit = 50, filter?: string) {
  const store = getStore();
  const query = q.trim().toLowerCase();
  let list = store.customers;

  if (filter === "completed") {
    const completedCustomerIds = new Set(
      store.invoices.filter((i) => i.status === "finalised").map((i) => i.customer_id),
    );
    list = list.filter((c) => completedCustomerIds.has(c.id));
  }

  if (query) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.phone && c.phone.includes(query)) ||
        (c.city && c.city.toLowerCase().includes(query)),
    );
  }
  const count = list.length;
  const start = (page - 1) * limit;
  const rows = list.slice(start, start + limit).map((c) => {
    const custInvoices = store.invoices.filter((i) => i.customer_id === c.id);
    const lastInvoice = custInvoices[0] || null;
    return {
      ...c,
      invoice_count: custInvoices.length,
      last_invoice_id: lastInvoice?.id || null,
      last_invoice_no: lastInvoice?.invoice_no || null,
      last_invoice_date: lastInvoice?.created_at || null,
      last_invoice_amount: lastInvoice?.grand_total ?? null,
    };
  });
  return { rows, count, page };
}

// Prescriptions
export function savePrescription(data: any, id?: string | null): string {
  const store = getStore();
  const rxId = id || crypto.randomUUID();
  const existingIdx = store.prescriptions.findIndex((p) => p.id === rxId);
  const now = new Date().toISOString().slice(0, 10);

  const rxRecord: Prescription = {
    id: rxId,
    customer_id: data.customer_id,
    test_date: data.test_date || now,
    examiner_name: data.examiner_name || "Optometrist",
    source: data.source || "In-store",
    remarks: data.remarks || null,
    valid_until: data.valid_until || null,
    bin_pd: data.bin_pd ?? null,
    vertex_distance: data.vertex_distance ?? null,
    pantoscopic_tilt: data.pantoscopic_tilt ?? null,
    od_sph: data.od_sph ?? null,
    od_cyl: data.od_cyl ?? null,
    od_axis: data.od_axis ?? null,
    od_add_power: data.od_add_power ?? null,
    od_prism: data.od_prism ?? null,
    od_base: data.od_base ?? null,
    od_va_unaided: data.od_va_unaided ?? null,
    od_va_aided: data.od_va_aided ?? null,
    od_pd_distance: data.od_pd_distance ?? null,
    od_pd_near: data.od_pd_near ?? null,
    od_seg_height: data.od_seg_height ?? null,
    os_sph: data.os_sph ?? null,
    os_cyl: data.os_cyl ?? null,
    os_axis: data.os_axis ?? null,
    os_add_power: data.os_add_power ?? null,
    os_prism: data.os_prism ?? null,
    os_base: data.os_base ?? null,
    os_va_unaided: data.os_va_unaided ?? null,
    os_va_aided: data.os_va_aided ?? null,
    os_pd_distance: data.os_pd_distance ?? null,
    os_pd_near: data.os_pd_near ?? null,
    os_seg_height: data.os_seg_height ?? null,
  };

  if (existingIdx >= 0) {
    store.prescriptions[existingIdx] = rxRecord;
  } else {
    store.prescriptions.unshift(rxRecord);
  }
  saveStore(store);
  return rxId;
}

export function getPrescriptionsForCustomer(customerId: string): Prescription[] {
  const store = getStore();
  return store.prescriptions.filter((p) => p.customer_id === customerId);
}

// Frames / Inventory
export function saveFrame(data: any, id?: string | null): string {
  const store = getStore();
  const frameId = id || crypto.randomUUID();
  const existingIdx = store.frames.findIndex((f) => f.id === frameId);

  const frameRecord: Frame = {
    id: frameId,
    model_no: data.model_no || "OX-FRAME",
    brand: data.brand || "Opti-X",
    colour: data.colour || "",
    size: data.size || "",
    material: data.material || "Metal",
    type: data.type || "full rim",
    gender_target: data.gender_target || "unisex",
    cost_paise: Number(data.cost_paise) || 0,
    mrp_paise: Number(data.mrp_paise) || 0,
    stock_qty: Number(data.stock_qty) || 0,
  };

  if (existingIdx >= 0) {
    store.frames[existingIdx] = frameRecord;
  } else {
    store.frames.unshift(frameRecord);
  }
  saveStore(store);
  return frameId;
}

export function searchFrames(q: string, page = 1, limit = 50) {
  const store = getStore();
  const query = q.trim().toLowerCase();
  let list = store.frames;
  if (query) {
    list = list.filter(
      (f) =>
        f.model_no.toLowerCase().includes(query) ||
        f.brand.toLowerCase().includes(query) ||
        f.colour.toLowerCase().includes(query),
    );
  }
  const count = list.length;
  const start = (page - 1) * limit;
  const rows = list.slice(start, start + limit);
  return { rows, count, page };
}

// Drafts
export function saveDraft(id: string, draft: any) {
  const store = getStore();
  const existing = store.drafts[id] || {};
  const currentVersion = Number(existing.version) || 0;
  const newVersion = currentVersion + 1;
  const orderId = existing.order_id || crypto.randomUUID();

  store.drafts[id] = {
    ...draft,
    id,
    order_id: orderId,
    version: newVersion,
    updated_at: new Date().toISOString(),
  };
  saveStore(store);
  return { id, order_id: orderId, version: newVersion };
}

export function getDraft(id: string) {
  const store = getStore();
  return store.drafts[id] || null;
}

// Invoices & Billing
export function finaliseInvoice(invoiceId: string, key: string, payments: any[]) {
  const store = getStore();
  const draft = store.drafts[invoiceId];
  if (!draft) {
    throw new Error("Draft not found");
  }

  const now = new Date();
  const fy = financialYear(now);
  const seq = store.nextInvoiceSeq++;
  const invNo = invoiceNumber(store.shop.invoice_prefix || "OX", fy, seq);

  // Calculate invoice
  const currentTaxes = store.taxes;
  const lines = (draft.items || []).map((l: any) => ({
    ...l,
    gst_rate_bp:
      currentTaxes.find((t) => t.id === l.tax_category_id)?.gst_rate_bp ?? 1200,
  }));

  const calc = calculateInvoice(
    lines,
    draft.overall_discount_paise || 0,
    draft.place_of_supply_state_code !== store.shop.state_code,
    store.shop.gst_scheme === "regular",
  );

  const orderId = draft.order_id || crypto.randomUUID();
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount_paise) || 0), 0);
  const balanceDue = Math.max(0, calc.grand_total - totalPaid);

  const cust = getCustomer(draft.customer_id);
  const isInterstate = (draft.place_of_supply_state_code || store.shop.state_code) !== store.shop.state_code;

  const invoiceRecord: Invoice = {
    id: invoiceId,
    shop_id: store.shop.id,
    order_id: orderId,
    customer_id: draft.customer_id,
    type: "tax_invoice",
    invoice_no: invNo,
    financial_year: fy,
    status: "finalised",
    display_status: "finalised",
    payment_status: balanceDue <= 0 ? "paid" : totalPaid > 0 ? "partial" : "unpaid",
    customer_snapshot: cust ? { id: cust.id, name: cust.name, phone: cust.phone, address: cust.address, city: cust.city, state_code: cust.state_code, gstin: cust.gstin } : null,
    shop_snapshot: store.shop,
    place_of_supply_state_code: draft.place_of_supply_state_code || store.shop.state_code,
    is_interstate: isInterstate,
    subtotal: calc.subtotal,
    discount_total: calc.discount_total,
    taxable_total: calc.taxable_total,
    cgst: calc.cgst,
    sgst: calc.sgst,
    igst: calc.igst,
    round_off: calc.round_off,
    grand_total: calc.grand_total,
    amount_paid: totalPaid,
    balance_due: balanceDue,
    refund_due: 0,
    overall_discount_paise: draft.overall_discount_paise || 0,
    draft_version: 1,
    draft_payments: [],
    created_at: now.toISOString(),
    finalised_at: now.toISOString(),
    original_invoice_id: null,
    credit_reason: null,
    cancel_reason: null,
  };

  // Items
  const invoiceItems: InvoiceItem[] = calc.items.map((item: any, idx: number) => ({
    id: crypto.randomUUID(),
    invoice_id: invoiceId,
    position: idx + 1,
    item_type: item.item_type || "frame",
    description: item.description || "Optical Product",
    specs: item.specs || {},
    frame_model_no: item.frame_model_no || "",
    lens_brand: item.lens_brand || "",
    qty: item.qty,
    unit: item.unit || "piece",
    unit_price_paise: item.unit_price_paise,
    discount_paise: item.discount_paise,
    taxable_paise: item.taxable_paise,
    gst_rate_bp: item.gst_rate_bp ?? 1200,
    cgst_paise: item.cgst_paise,
    sgst_paise: item.sgst_paise,
    igst_paise: item.igst_paise,
    cgst_rate_bp: item.cgst_paise ? item.gst_rate_bp / 2 : 0,
    sgst_rate_bp: item.sgst_paise ? item.gst_rate_bp / 2 : 0,
    igst_rate_bp: item.igst_paise ? item.gst_rate_bp : 0,
    tax_category_id: item.tax_category_id || "",
    hsn_code: currentTaxes.find((t) => t.id === item.tax_category_id)?.hsn_code || "9003",
  }));

  // Order
  const orderRecord: Order = {
    id: orderId,
    shop_id: store.shop.id,
    customer_id: draft.customer_id,
    prescription_id: draft.prescription_id || null,
    order_no: `ORD-${invNo}`,
    status: "Ordered",
    lab_name: "In-house Lab",
    lab_sent_at: null,
    promised_date: draft.promised_date || null,
    delivered_at: null,
    notes: draft.notes || null,
    created_at: now.toISOString(),
  };

  // Payments
  const paymentRecords: Payment[] = payments.map((p) => ({
    id: crypto.randomUUID(),
    shop_id: store.shop.id,
    invoice_id: invoiceId,
    amount_paise: Number(p.amount_paise) || 0,
    mode: p.mode || "cash",
    reference_no: p.reference_no || "",
    paid_at: now.toISOString(),
  }));

  // Deduct frame stock
  for (const item of lines) {
    if (item.frame_id) {
      const fr = store.frames.find((f) => f.id === item.frame_id);
      if (fr) {
        fr.stock_qty = Math.max(0, fr.stock_qty - (item.qty || 1));
      }
    }
  }

  if (store.uploads && Array.isArray(store.uploads)) {
    for (const u of store.uploads) {
      if (u.order_id === draft.order_id || u.order_id === invoiceId) {
        u.order_id = orderId;
      }
    }
  }

  store.invoices.unshift(invoiceRecord);
  store.invoice_items.push(...invoiceItems);
  store.orders.unshift(orderRecord);
  store.payments.push(...paymentRecords);
  delete store.drafts[invoiceId];

  saveStore(store);
  return invoiceId;
}

export function searchInvoices(q: string, page = 1, limit = 50, paymentFilter?: string) {
  const store = getStore();
  const query = q.trim().toLowerCase();
  let list = store.invoices;

  if (paymentFilter === "outstanding") {
    list = list.filter((i) => i.balance_due > 0);
  } else if (paymentFilter) {
    list = list.filter((i) => i.payment_status === paymentFilter);
  }

  if (query) {
    list = list.filter((i) => {
      const cust = store.customers.find((c) => c.id === i.customer_id);
      return (
        i.invoice_no?.toLowerCase().includes(query) ||
        cust?.name.toLowerCase().includes(query) ||
        cust?.phone?.includes(query)
      );
    });
  }

  const count = list.length;
  const start = (page - 1) * limit;
  const rows = list.slice(start, start + limit);
  return { rows, count, page };
}

export function searchOrders(q: string, page = 1, limit = 50) {
  const store = getStore();
  const query = q.trim().toLowerCase();
  let list = store.orders.map((o) => {
    const cust = store.customers.find((c) => c.id === o.customer_id);
    return {
      ...o,
      customers: cust ? { name: cust.name, phone: cust.phone } : null,
    };
  });

  if (query) {
    list = list.filter(
      (o) =>
        o.customers?.name.toLowerCase().includes(query) ||
        o.customers?.phone?.includes(query) ||
        o.status.toLowerCase().includes(query),
    );
  }

  const count = list.length;
  const start = (page - 1) * limit;
  const rows = list.slice(start, start + limit);
  return { rows, count, page };
}

export function getDashboardStats() {
  const store = getStore();
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const todaySales = store.invoices
    .filter((i) => i.finalised_at?.startsWith(today))
    .reduce((sum, i) => sum + i.grand_total, 0);

  const monthSales = store.invoices
    .filter((i) => i.finalised_at?.startsWith(thisMonth))
    .reduce((sum, i) => sum + i.grand_total, 0);

  const dues = store.invoices.reduce((sum, i) => sum + i.balance_due, 0);
  const readyOrders = store.orders.filter((o) => o.status === "Ready").length;

  const recent = store.invoices.slice(0, 6);
  const due = store.orders
    .filter((o) => o.status !== "Delivered")
    .slice(0, 10)
    .map((o) => {
      const cust = store.customers.find((c) => c.id === o.customer_id);
      return {
        ...o,
        customers: cust ? { name: cust.name, phone: cust.phone } : null,
      };
    });

  return {
    stats: {
      today: todaySales,
      month: monthSales,
      dues,
      ready: readyOrders,
    },
    recent,
    due,
  };
}

export async function loadPrintDataFromStore(id: string): Promise<PrintData> {
  const store = getStore();
  const invoice = store.invoices.find((i) => i.id === id);
  if (!invoice) throw new Error("Finalised invoice not found");

  const items = store.invoice_items.filter((item) => item.invoice_id === id);
  const payments = store.payments.filter((p) => p.invoice_id === id);
  const order = store.orders.find((o) => o.id === invoice.order_id);
  const customer = store.customers.find((c) => c.id === invoice.customer_id);
  const rx = order?.prescription_id
    ? store.prescriptions.find((p) => p.id === order.prescription_id)
    : null;
  const upload =
    store.uploads.find(
      (u) =>
        u.order_id === invoice.order_id ||
        (order && u.order_id === order.id) ||
        u.order_id === invoice.id ||
        u.order_id === invoice.customer_id,
    ) ||
    (store.uploads.length > 0 && store.invoices.length === 1
      ? store.uploads[0]
      : null);

  let photoPath = upload ? upload.storage_path : null;
  if (photoPath && photoPath.endsWith(".webp")) {
    const jpgCandidate = photoPath.replace(/\.webp$/, ".jpg");
    const localJpg = path.join(
      process.cwd(),
      "public",
      jpgCandidate.startsWith("/") ? jpgCandidate.slice(1) : jpgCandidate,
    );
    if (fs.existsSync(localJpg)) {
      photoPath = jpgCandidate;
    }
  }

  const shop = invoice.shop_snapshot || store.shop;
  const upi =
    shop?.upi_id && invoice.balance_due > 0
      ? `upi://pay?${new URLSearchParams({
        pa: shop.upi_id,
        pn: shop.name,
        am: `${Math.floor(invoice.balance_due / 100)}.${String(invoice.balance_due % 100).padStart(2, "0")}`,
        cu: "INR",
        tn: invoice.invoice_no || "",
      })}`
      : null;

  return {
    invoice,
    items,
    payments,
    order: (order || {
      id: "ord-default",
      shop_id: shop.id,
      customer_id: invoice.customer_id,
      prescription_id: null,
      status: "Ready",
      lab_name: "In-house",
      promised_date: null,
      created_at: invoice.created_at,
    }) as Order,
    prescription: rx || null,
    photo: photoPath,
    upiQr: upi ? await QRCode.toDataURL(upi, { margin: 1, width: 180 }) : null,
    originalNumber: null,
    logo: shop.logo_path || null,
    signature: shop.signature_path || null,
  };
}

export function getReportsData(fromStr?: string, toStr?: string): Report {
  const store = getStore();
  const from = fromStr || "2000-01-01";
  const to = toStr || "2099-12-31";

  const invoices = store.invoices.filter((i) => {
    if (i.status !== "finalised") return false;
    const date = i.created_at.slice(0, 10);
    return date >= from && date <= to;
  });

  const dailyMap: Record<string, { sales: number; taxable: number; tax: number }> = {};
  for (const inv of invoices) {
    const day = inv.created_at.slice(0, 10);
    if (!dailyMap[day]) {
      dailyMap[day] = { sales: 0, taxable: 0, tax: 0 };
    }
    dailyMap[day].sales += inv.grand_total;
    dailyMap[day].taxable += inv.taxable_total;
    dailyMap[day].tax += inv.cgst + inv.sgst + inv.igst;
  }
  const daily = Object.entries(dailyMap)
    .map(([day, val]) => ({
      day,
      sales: val.sales,
      taxable: val.taxable,
      tax: val.tax,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  if (daily.length === 0) {
    daily.push({
      day: new Date().toISOString().slice(0, 10),
      sales: 0,
      taxable: 0,
      tax: 0,
    });
  }

  const gstMap: Record<
    string,
    {
      hsn_code: string;
      gst_rate_bp: number;
      taxable: number;
      cgst: number;
      sgst: number;
      igst: number;
    }
  > = {};
  const matchingInvoiceIds = new Set(invoices.map((i) => i.id));
  const items = store.invoice_items.filter(
    (it) => Boolean(it.invoice_id && matchingInvoiceIds.has(it.invoice_id)),
  );

  for (const it of items) {
    const key = `${it.hsn_code || "9003"}_${it.gst_rate_bp}`;
    if (!gstMap[key]) {
      gstMap[key] = {
        hsn_code: it.hsn_code || "9003",
        gst_rate_bp: it.gst_rate_bp,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
      };
    }
    gstMap[key].taxable += it.taxable_paise;
    gstMap[key].cgst += it.cgst_paise;
    gstMap[key].sgst += it.sgst_paise;
    gstMap[key].igst += it.igst_paise;
  }
  const gst = Object.values(gstMap);

  const modeMap: Record<string, number> = {};
  const payments = store.payments.filter(
    (p) => Boolean(p.invoice_id && matchingInvoiceIds.has(p.invoice_id)),
  );
  for (const p of payments) {
    modeMap[p.mode] = (modeMap[p.mode] || 0) + (p.amount_paise || 0);
  }
  const modes = Object.entries(modeMap).map(([mode, amount]) => ({ mode, amount }));
  if (modes.length === 0) {
    modes.push({ mode: "Cash", amount: invoices.reduce((s, i) => s + i.amount_paid, 0) });
  }

  const now = Date.now();
  let b0_30 = 0,
    b31_60 = 0,
    b61_90 = 0,
    b90plus = 0;
  for (const inv of store.invoices) {
    if (inv.balance_due > 0) {
      const days = Math.floor(
        (now - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days <= 30) b0_30 += inv.balance_due;
      else if (days <= 60) b31_60 += inv.balance_due;
      else if (days <= 90) b61_90 += inv.balance_due;
      else b90plus += inv.balance_due;
    }
  }
  const ageing = [
    { bucket: "0–30 days", amount: b0_30 },
    { bucket: "31–60 days", amount: b31_60 },
    { bucket: "61–90 days", amount: b61_90 },
    { bucket: "90+ days", amount: b90plus },
  ];

  const prodMap: Record<string, { quantity: number; sales: number }> = {};
  for (const it of items) {
    const name = it.lens_brand || it.frame_model_no || it.description || "Optical item";
    if (!prodMap[name]) prodMap[name] = { quantity: 0, sales: 0 };
    prodMap[name].quantity += it.qty || 1;
    prodMap[name].sales += it.taxable_paise;
  }
  const products = Object.entries(prodMap)
    .map(([product, v]) => ({
      product,
      quantity: v.quantity,
      sales: v.sales,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 10);

  const totalSalesAll = invoices.reduce((s, i) => s + i.grand_total, 0);
  const staff = [
    { full_name: store.profile.full_name || "Store Admin", sales: totalSalesAll },
  ];

  return { daily, gst, modes, ageing, products, staff };
}
