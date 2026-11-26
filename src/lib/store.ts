import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import QRCode from "qrcode";
import type {
  Customer,
  Prescription,
  Frame,
  Lens,
  TaxCategory,
  Invoice,
  InvoiceItem,
  Order,
  Payment,
  Shop,
  Profile,
  PrintData,
  Report,
  DataRequest,
} from "./types";
import { calculateInvoice, financialYear, invoiceNumber } from "./money";
import {
  isCloudStorageEnabled,
  isTestEnvironment,
  readCloudStore,
  writeCloudStore,
  deleteCloudAsset,
} from "./cloud-store";

let readOnlyRootDetected = false;

function isReadOnlyFsError(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException)?.code;
  return code === "EROFS" || code === "EACCES" || code === "EPERM";
}

export function getDataDir(): string {
  if (process.env.OPTI_DATA_DIR) return process.env.OPTI_DATA_DIR;
  if (readOnlyRootDetected) {
    return path.join(os.tmpdir(), "opti-x-data");
  }
  return path.join(process.cwd(), "data");
}

export function getStorePath(): string {
  if (process.env.OPTI_STORE_PATH) return process.env.OPTI_STORE_PATH;
  return path.join(getDataDir(), "store.json");
}

export function getBackupPath(): string {
  if (process.env.OPTI_BACKUP_PATH) return process.env.OPTI_BACKUP_PATH;
  return path.join(getDataDir(), "store.json.bak");
}

export function getUploadsDir(): string {
  if (process.env.OPTI_UPLOADS_DIR) return process.env.OPTI_UPLOADS_DIR;
  if (readOnlyRootDetected) {
    return path.join(os.tmpdir(), "opti-x-uploads");
  }
  return path.join(process.cwd(), "public", "uploads");
}

export function getStorageBackend(): "supabase" | "local-disk" | "ephemeral-tmp" {
  if (isCloudStorageEnabled()) return "supabase";
  if (readOnlyRootDetected) return "ephemeral-tmp";
  return "local-disk";
}

export const DEFAULT_SHOP: Shop = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Opti-X",
  legal_name: "Opti-X",
  gstin: null,
  address: "",
  city: "",
  state: "",
  state_code: "",
  pincode: "",
  phone: "8123649448",
  email: "hello@opti-x.in",
  gst_scheme: "unregistered",
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
  grievance_email: "hello@opti-x.in",
  retention_months: 72,
  clinical_retention_months: 24,
  hsn_digits: 4,
  invoice_recipient_threshold_paise: 5000000,
  upi_id: null,
  bank_details: null,
  einvoice_enabled: false,
  require_owner_mfa: false,
  logo_path: "/logo.png",
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
  lenses: Lens[];
  taxes: TaxCategory[];
  invoices: Invoice[];
  invoice_items: InvoiceItem[];
  orders: Order[];
  payments: Payment[];
  uploads: Array<{ id: string; order_id: string; storage_path: string; file_size: number; created_at: string }>;
  drafts: Record<string, any>;
  nextInvoiceSeq: number;
  members?: Profile[];
  requests?: DataRequest[];
  mfa?: {
    secret: string | null;
    pendingSecret: string | null;
    enabled: boolean;
  };
}

function initialStore(): LocalStore {
  return {
    shop: DEFAULT_SHOP,
    profile: DEFAULT_PROFILE,
    customers: [],
    prescriptions: [],
    frames: [],
    lenses: [],
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
let pendingCloudSave: Promise<void> = Promise.resolve();

function normalizeStore(s: LocalStore): LocalStore {
  if (!s.shop) s.shop = { ...DEFAULT_SHOP };
  if (!s.profile) s.profile = { ...DEFAULT_PROFILE };
  if (!s.customers) s.customers = [];
  if (!s.prescriptions) s.prescriptions = [];
  if (!s.frames) s.frames = [];
  if (!s.lenses) s.lenses = [];
  if (!s.taxes || !s.taxes.length) s.taxes = initialStore().taxes;
  if (!s.invoices) s.invoices = [];
  if (!s.invoice_items) s.invoice_items = [];
  if (!s.orders) s.orders = [];
  if (!s.payments) s.payments = [];
  if (!s.uploads) s.uploads = [];
  if (!s.drafts) s.drafts = {};
  if (!s.nextInvoiceSeq) s.nextInvoiceSeq = 1;
  if (!s.members) s.members = [];
  if (!s.requests) s.requests = [];
  return s;
}

function writeLocalStore(jsonStr: string): void {
  const attemptWrite = () => {
    const dataDir = getDataDir();
    const storePath = getStorePath();
    const backupPath = getBackupPath();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const tempPath = path.join(
      dataDir,
      `store.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
    );
    fs.writeFileSync(tempPath, jsonStr, "utf8");
    try {
      fs.writeFileSync(backupPath, jsonStr, "utf8");
    } catch {}
    try {
      fs.renameSync(tempPath, storePath);
    } catch {
      fs.copyFileSync(tempPath, storePath);
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
  };

  try {
    attemptWrite();
  } catch (err) {
    if (!isTestEnvironment() && isReadOnlyFsError(err) && !readOnlyRootDetected) {
      readOnlyRootDetected = true;
      attemptWrite();
      return;
    }
    throw err;
  }
}

export async function loadStore(): Promise<LocalStore> {
  if (isCloudStorageEnabled()) {
    const cloudRaw = await readCloudStore();
    if (cloudRaw !== null) {
      memoryStore = normalizeStore(JSON.parse(cloudRaw));
      return memoryStore;
    }
    // First-time cloud initialization: seed from bundled data/store.json if present, else initialStore
    const bundledPath = path.join(process.cwd(), "data", "store.json");
    let seed: LocalStore;
    try {
      if (fs.existsSync(bundledPath)) {
        seed = normalizeStore(JSON.parse(fs.readFileSync(bundledPath, "utf8")));
      } else {
        seed = initialStore();
      }
    } catch {
      seed = initialStore();
    }
    memoryStore = seed;
    await writeCloudStore(JSON.stringify(seed, null, 2));
    return memoryStore;
  }
  return getStore();
}

export async function persistStore(store?: LocalStore): Promise<void> {
  if (store) {
    saveStore(store);
  }
  await pendingCloudSave;
}

export function getStore(): LocalStore {
  if (isCloudStorageEnabled() && memoryStore) {
    return memoryStore;
  }

  const dataDir = getDataDir();
  const storePath = getStorePath();
  const backupPath = getBackupPath();

  try {
    if (!fs.existsSync(dataDir) && !readOnlyRootDetected) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        if (isReadOnlyFsError(err) && !isTestEnvironment()) {
          readOnlyRootDetected = true;
        }
      }
    }

    let raw: string | null = null;
    if (fs.existsSync(storePath)) {
      try {
        const candidate = fs.readFileSync(storePath, "utf8");
        JSON.parse(candidate);
        raw = candidate;
      } catch (err) {
        console.warn("Primary store corrupted or invalid JSON, attempting backup recovery:", err);
        raw = null;
      }
    }

    if (raw === null && fs.existsSync(backupPath)) {
      try {
        const candidate = fs.readFileSync(backupPath, "utf8");
        JSON.parse(candidate);
        raw = candidate;
        console.info("Recovered store data from backup copy.");
        try {
          fs.writeFileSync(storePath, raw, "utf8");
        } catch {}
      } catch (err) {
        console.error("Backup store also corrupted:", err);
      }
    }

    if (raw === null && !isTestEnvironment()) {
      const bundledPath = path.join(process.cwd(), "data", "store.json");
      if (bundledPath !== storePath && fs.existsSync(bundledPath)) {
        raw = fs.readFileSync(bundledPath, "utf8");
      }
    }

    if (raw !== null) {
      memoryStore = normalizeStore(JSON.parse(raw));
      return memoryStore;
    }
  } catch (err) {
    console.error("Store load failure:", err);
  }

  if (memoryStore) return memoryStore;
  memoryStore = initialStore();
  saveStore(memoryStore);
  return memoryStore;
}

export function resetMemoryStoreForTesting(): void {
  memoryStore = null;
  pendingCloudSave = Promise.resolve();
}

export function saveStore(store: LocalStore): void {
  memoryStore = store;
  const jsonStr = JSON.stringify(store, null, 2);

  if (isCloudStorageEnabled()) {
    pendingCloudSave = pendingCloudSave
      .catch(() => undefined)
      .then(() => writeCloudStore(jsonStr));
    return;
  }

  try {
    writeLocalStore(jsonStr);
  } catch (err) {
    console.error("Failed to write store.json atomically:", err);
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

export function saveLens(data: any, id?: string | null): string {
  const store = getStore();
  const lensId = id || crypto.randomUUID();
  const existingIdx = store.lenses.findIndex((l) => l.id === lensId);

  const lensRecord: Lens = {
    id: lensId,
    lens_code: data.lens_code || "OX-LENS",
    brand: data.brand || "Opti-X",
    name: data.name || "Single Vision",
    lens_type: data.lens_type || "single vision",
    lens_index: data.lens_index || "1.56 Thin",
    coatings: data.coatings || "Anti-Glare (ARC)",
    tint: data.tint || "Clear",
    dia_mm: data.dia_mm || "",
    sph_range: data.sph_range || "",
    cyl_range: data.cyl_range || "",
    cost_paise: Number(data.cost_paise) || 0,
    mrp_paise: Number(data.mrp_paise) || 0,
    stock_qty: Number(data.stock_qty) || 0,
    hsn_code: data.hsn_code || "9001",
    is_active: data.is_active !== false,
  };

  if (existingIdx >= 0) {
    store.lenses[existingIdx] = lensRecord;
  } else {
    store.lenses.unshift(lensRecord);
  }
  saveStore(store);
  return lensId;
}

export function searchLenses(q: string, page = 1, limit = 50) {
  const store = getStore();
  const query = q.trim().toLowerCase();
  let list = store.lenses || [];
  if (query) {
    list = list.filter(
      (l) =>
        (l.lens_code && l.lens_code.toLowerCase().includes(query)) ||
        (l.brand && l.brand.toLowerCase().includes(query)) ||
        (l.name && l.name.toLowerCase().includes(query)) ||
        (l.lens_type && l.lens_type.toLowerCase().includes(query)) ||
        (l.lens_index && l.lens_index.toLowerCase().includes(query)) ||
        (l.coatings && l.coatings.toLowerCase().includes(query)),
    );
  }
  const count = list.length;
  const start = (page - 1) * limit;
  const rows = list.slice(start, start + limit);
  return { rows, count, page };
}

export function deleteLens(id: string): void {
  const store = getStore();
  store.lenses = (store.lenses || []).filter((l) => l.id !== id);
  saveStore(store);
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
export function finaliseInvoice(
  invoiceId: string,
  key: string,
  payments: any[],
  isBookingFlag?: boolean,
) {
  const store = getStore();

  // Idempotency guard: return existing finalized invoice if already created
  const existingInv = store.invoices.find((i) => i.id === invoiceId);
  if (existingInv && existingInv.status === "finalised") {
    return existingInv.id;
  }

  const draft = store.drafts[invoiceId];
  if (!draft) {
    throw new Error("Draft not found");
  }

  // Ensure sequence number is strictly higher than any existing invoice
  const maxExistingSeq = store.invoices.reduce((max, inv) => {
    if (inv.invoice_no) {
      const parts = inv.invoice_no.split("/");
      const last = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(last) && last > max) return last;
    }
    return max;
  }, 0);
  if (!store.nextInvoiceSeq || store.nextInvoiceSeq <= maxExistingSeq) {
    store.nextInvoiceSeq = maxExistingSeq + 1;
  }

  const now = new Date();
  const fy = financialYear(now);
  const seq = store.nextInvoiceSeq++;
  const invNo = invoiceNumber(store.shop.invoice_prefix || "OX", fy, seq);

  // Calculate invoice
  const currentTaxes = store.taxes;
  const lines = (draft.items || []).map((l: any) => {
    const matchedTax = currentTaxes.find((t) => t.id === l.tax_category_id);
    const gstRateBp =
      matchedTax != null
        ? Number(matchedTax.gst_rate_bp)
        : l.gst_rate_bp != null && !isNaN(Number(l.gst_rate_bp))
          ? Number(l.gst_rate_bp)
          : 1200;
    return {
      ...l,
      qty: Number(l.qty) || 1,
      unit_price_paise: Number(l.unit_price_paise) || 0,
      discount_paise: Number(l.discount_paise) || 0,
      gst_rate_bp: gstRateBp,
    };
  });

  const shopState = (store.shop.state_code || "").trim();
  const posState = (draft.place_of_supply_state_code || shopState).trim();
  const isInterstate = Boolean(shopState && posState && posState !== shopState);

  const calc = calculateInvoice(
    lines,
    draft.overall_discount_paise || 0,
    isInterstate,
    store.shop.gst_scheme === "regular",
  );

  const orderId = draft.order_id || crypto.randomUUID();
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount_paise) || 0), 0);
  const balanceDue = Math.max(0, calc.grand_total - totalPaid);

  const cust = draft.customer_id ? getCustomer(draft.customer_id) : null;
  const customerSnapshot = cust
    ? {
        id: cust.id,
        name: cust.name,
        phone: cust.phone,
        address: cust.address,
        city: cust.city,
        state_code: cust.state_code,
        gstin: cust.gstin,
      }
    : {
        id: draft.customer_id || "walk-in",
        name: "Walk-in Customer",
        phone: "",
        address: "",
        city: "",
        state_code: store.shop.state_code || "29",
        gstin: null,
      };

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
    is_booking: Boolean(isBookingFlag ?? draft.is_booking),
    customer_snapshot: customerSnapshot,
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
  const invoiceItems: InvoiceItem[] = calc.items.map((item: any, idx: number) => {
    const specs: Record<string, string | null> = {
      ...(item.specs || {}),
      ...(item.lens_code ? { lens_code: item.lens_code } : {}),
      ...(item.lens_type ? { lens_type: item.lens_type } : {}),
      ...(item.lens_index ? { lens_index: item.lens_index } : {}),
      ...(item.coatings ? { coatings: item.coatings } : {}),
      ...(item.tint ? { tint: item.tint } : {}),
    };
    return {
      id: crypto.randomUUID(),
      invoice_id: invoiceId,
      position: idx + 1,
      item_type: item.item_type || "frame",
      description: item.description || "Optical Product",
      specs,
      frame_model_no: item.frame_model_no || "",
      lens_id: item.lens_id || null,
      lens_code: item.lens_code || null,
      lens_brand: item.lens_brand || "",
      lens_type: item.lens_type || null,
      lens_index: item.lens_index || null,
      coatings: item.coatings || null,
      tint: item.tint || null,
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
    };
  });

  // Order
  const orderRecord: Order = {
    id: orderId,
    shop_id: store.shop.id,
    customer_id: draft.customer_id,
    prescription_id: draft.prescription_id || null,
    order_no: `ORD-${invNo}`,
    status: "Ordered",
    lab_name: draft.lab_name || "In-house Lab",
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
    // Deduct lens stock
    if (store.lenses) {
      if (item.lens_id) {
        const ln = store.lenses.find((l) => l.id === item.lens_id);
        if (ln) ln.stock_qty = Math.max(0, ln.stock_qty - (item.qty || 1));
      } else if (item.lens_code) {
        const ln = store.lenses.find(
          (l) => l.lens_code.toLowerCase() === item.lens_code.toLowerCase(),
        );
        if (ln) ln.stock_qty = Math.max(0, ln.stock_qty - (item.qty || 1));
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

export function searchInvoices(
  q: string,
  page = 1,
  limit = 50,
  paymentFilter?: string,
  statusFilter?: string,
  fromDate?: string,
  toDate?: string,
) {
  const store = getStore();
  const query = q.trim().toLowerCase();
  let list: Invoice[] = [...store.invoices];

  // Include saved drafts if filtering for drafts or all statuses without a payment filter
  if (statusFilter === "draft" || (!statusFilter && !paymentFilter)) {
    const draftInvoices: Invoice[] = Object.values(store.drafts || {}).map((d: any) => {
      const cust = d.customer_id ? getCustomer(d.customer_id) : null;
      return {
        id: d.id,
        shop_id: store.shop.id,
        customer_id: d.customer_id || "",
        order_id: d.order_id || "",
        invoice_no: null,
        type: "tax_invoice",
        status: "draft",
        display_status: "draft",
        payment_status: "unpaid",
        customer_snapshot: cust ? { id: cust.id, name: cust.name, phone: cust.phone } : null,
        shop_snapshot: null,
        place_of_supply_state_code: d.place_of_supply_state_code || "",
        is_interstate: false,
        subtotal: 0,
        discount_total: 0,
        taxable_total: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        round_off: 0,
        grand_total: 0,
        amount_paid: 0,
        balance_due: 0,
        refund_due: 0,
        overall_discount_paise: d.overall_discount_paise || 0,
        draft_version: d.version || 1,
        draft_payments: d.payments || [],
        created_at: d.updated_at || new Date().toISOString(),
        finalised_at: null,
        original_invoice_id: null,
        credit_reason: null,
        cancel_reason: null,
      };
    });
    list = [...draftInvoices, ...list];
  }

  if (statusFilter) {
    list = list.filter((i) => i.status === statusFilter || i.display_status === statusFilter);
  }

  if (paymentFilter === "outstanding") {
    list = list.filter(
      (i) => i.status === "finalised" && (i.balance_due > 0 || i.refund_due > 0),
    );
  } else if (paymentFilter) {
    list = list.filter((i) => i.payment_status === paymentFilter);
  }

  if (fromDate) {
    list = list.filter((i) => (i.finalised_at || i.created_at).slice(0, 10) >= fromDate);
  }
  if (toDate) {
    list = list.filter((i) => (i.finalised_at || i.created_at).slice(0, 10) <= toDate);
  }

  if (query) {
    list = list.filter((i) => {
      const cust = store.customers.find((c) => c.id === i.customer_id);
      return (
        i.invoice_no?.toLowerCase().includes(query) ||
        i.customer_snapshot?.name?.toLowerCase().includes(query) ||
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

export function enrichOrderWithInvoice(o: Order, store: LocalStore): Order {
  const cust = store.customers.find((c) => c.id === o.customer_id);
  const inv =
    store.invoices.find((i) => i.order_id === o.id && i.type !== "credit_note") ||
    store.invoices.find((i) => i.order_id === o.id);
  return {
    ...o,
    customers: cust ? { name: cust.name, phone: cust.phone } : undefined,
    invoice_id: inv?.id || null,
    invoice_no: inv?.invoice_no || null,
    grand_total: inv?.grand_total ?? 0,
    amount_paid: inv?.amount_paid ?? 0,
    balance_due: inv?.balance_due ?? 0,
    is_booking: Boolean(inv?.is_booking),
  };
}

export function searchOrders(q: string, page = 1, limit = 50) {
  const store = getStore();
  const query = q.trim().toLowerCase();
  let list = store.orders.map((o) => enrichOrderWithInvoice(o, store));

  if (query) {
    list = list.filter(
      (o) =>
        o.order_no.toLowerCase().includes(query) ||
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

export function bookOrder(input: {
  customer_id?: string | null;
  customer?: {
    name: string;
    phone: string;
    age_years?: number | null;
    city?: string;
    gender?: string;
  };
  prescription?: Record<string, any> | null;
  items: any[];
  advance_paise: number;
  payment_mode: string;
  reference_no?: string;
  promised_date?: string | null;
  lab_name?: string;
  notes?: string;
}): { orderId: string; invoiceId: string; customerId: string } {
  const store = getStore();
  let customerId = input.customer_id || "";

  if (!customerId) {
    if (!input.customer) throw new Error("Customer details required");
    // Reuse existing customer if phone number matches cleanly
    const existingByPhone = store.customers.find(
      (c) => c.phone && c.phone === input.customer!.phone,
    );
    if (existingByPhone) {
      customerId = existingByPhone.id;
    } else {
      customerId = saveCustomer({
        name: input.customer.name,
        phone: input.customer.phone,
        age_years: input.customer.age_years ?? null,
        city: input.customer.city || "",
        gender: input.customer.gender || "undisclosed",
        state_code: store.shop.state_code || "",
        consent_given: true,
      });
    }
  }

  let prescriptionId: string | null = null;
  if (input.prescription) {
    const rx = input.prescription;
    const hasRxValues = [
      rx.od_sph,
      rx.od_cyl,
      rx.od_add_power,
      rx.os_sph,
      rx.os_cyl,
      rx.os_add_power,
      rx.bin_pd,
    ].some((v) => v != null && v !== "");
    if (hasRxValues) {
      prescriptionId = savePrescription({
        ...rx,
        customer_id: customerId,
        test_date: new Date().toISOString().slice(0, 10),
        examiner_name: rx.examiner_name || store.profile.full_name || "Optometrist",
        source: rx.source || "in_shop",
      });
    }
  }

  const draftId = crypto.randomUUID();
  const payments =
    input.advance_paise > 0
      ? [
          {
            amount_paise: input.advance_paise,
            mode: input.payment_mode || "cash",
            reference_no: input.reference_no || "Advance",
            idempotency_key: crypto.randomUUID(),
          },
        ]
      : [];

  saveDraft(draftId, {
    id: draftId,
    customer_id: customerId,
    prescription_id: prescriptionId,
    place_of_supply_state_code: store.shop.state_code || "",
    overall_discount_paise: 0,
    promised_date: input.promised_date || null,
    lab_name: input.lab_name || "In-house Lab",
    notes: input.notes || "",
    is_booking: true,
    items: input.items,
    payments,
  });

  const invoiceId = finaliseInvoice(draftId, crypto.randomUUID(), payments, true);
  const inv = getStore().invoices.find((i) => i.id === invoiceId);
  return {
    orderId: inv?.order_id || "",
    invoiceId,
    customerId,
  };
}

export function completeOrder(input: {
  order_id: string;
  amount_paise: number;
  mode: string;
  reference_no?: string;
  mark_delivered?: boolean;
  notes?: string;
}): { orderId: string; invoiceId: string | null } {
  const store = getStore();
  const ord = store.orders.find((o) => o.id === input.order_id);
  if (!ord) throw new Error("Order not found");

  const inv =
    store.invoices.find((i) => i.order_id === ord.id && i.type !== "credit_note") ||
    store.invoices.find((i) => i.order_id === ord.id);

  if (input.amount_paise > 0 && inv) {
    if (input.amount_paise > inv.balance_due) {
      throw new Error(
        `Payment exceeds remaining balance (${inv.balance_due / 100})`,
      );
    }
    store.payments.push({
      id: crypto.randomUUID(),
      shop_id: store.shop.id,
      invoice_id: inv.id,
      amount_paise: input.amount_paise,
      mode: input.mode || "cash",
      reference_no: input.reference_no || "Final payment",
      paid_at: new Date().toISOString(),
    });
    inv.amount_paid += input.amount_paise;
    inv.balance_due = Math.max(0, inv.grand_total - inv.amount_paid);
    inv.payment_status =
      inv.balance_due <= 0 ? "paid" : inv.amount_paid > 0 ? "partial" : "unpaid";
  }

  if (input.mark_delivered !== false) {
    ord.status = "Delivered";
    ord.delivered_at = new Date().toISOString();
  }
  if (input.notes !== undefined) {
    ord.notes = input.notes;
  }

  saveStore(store);
  return { orderId: ord.id, invoiceId: inv?.id || null };
}

export function getDashboardStats() {
  const store = getStore();
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const activeSalesInvoices = store.invoices.filter(
    (i) => i.status === "finalised" || i.status === "credited",
  );

  const todaySales = activeSalesInvoices
    .filter((i) => i.finalised_at?.startsWith(today))
    .reduce((sum, i) => sum + i.grand_total, 0);

  const monthSales = activeSalesInvoices
    .filter((i) => i.finalised_at?.startsWith(thisMonth))
    .reduce((sum, i) => sum + i.grand_total, 0);

  const dues = store.invoices
    .filter((i) => i.status === "finalised")
    .reduce((sum, i) => sum + i.balance_due, 0);
  const readyOrders = store.orders.filter((o) => o.status === "Ready").length;

  const recent = store.invoices.slice(0, 6);
  const due = store.orders
    .filter((o) => o.status !== "Delivered")
    .slice(0, 10)
    .map((o) => enrichOrderWithInvoice(o, store));

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
  const customerSnapshot = invoice.customer_snapshot || (customer ? {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    city: customer.city,
    state_code: customer.state_code,
    gstin: customer.gstin,
  } : {
    id: invoice.customer_id || "walk-in",
    name: "Walk-in Customer",
    phone: "",
    address: "",
    city: "",
    state_code: shop.state_code || "29",
    gstin: null,
  });

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
    invoice: {
      ...invoice,
      shop_snapshot: shop,
      customer_snapshot: customerSnapshot,
    },
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
    if (i.status !== "finalised" && i.status !== "credited") return false;
    const date = (i.finalised_at || i.created_at).slice(0, 10);
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
  const payments = store.payments.filter((p) => {
    const pDate = (p.paid_at || "").slice(0, 10);
    return (
      (p.invoice_id && matchingInvoiceIds.has(p.invoice_id)) ||
      (pDate >= from && pDate <= to)
    );
  });
  for (const p of payments) {
    modeMap[p.mode] = (modeMap[p.mode] || 0) + (p.amount_paise || 0);
  }
  const modes = Object.entries(modeMap).map(([mode, amount]) => ({ mode, amount }));

  const now = Date.now();
  let b0_30 = 0,
    b31_60 = 0,
    b61_90 = 0,
    b90plus = 0;
  for (const inv of store.invoices) {
    if (inv.status === "finalised" && inv.balance_due > 0) {
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

export function saveTaxCategory(data: Partial<TaxCategory>, id?: string): string {
  const store = getStore();
  const taxId = id || crypto.randomUUID();
  const existingIdx = store.taxes.findIndex((t) => t.id === taxId);
  const record: TaxCategory = {
    id: taxId,
    name: data.name || "GST Category",
    hsn_code: data.hsn_code || "9003",
    gst_rate_bp:
      data.gst_rate_bp != null && !isNaN(Number(data.gst_rate_bp))
        ? Number(data.gst_rate_bp)
        : 1200,
    effective_from: data.effective_from || new Date().toISOString().split("T")[0],
    is_active: data.is_active ?? true,
  };
  if (existingIdx >= 0) {
    store.taxes[existingIdx] = record;
  } else {
    store.taxes.unshift(record);
  }
  saveStore(store);
  return taxId;
}

export function cancelInvoice(invoiceId: string, reason: string, restock = false): void {
  const store = getStore();
  const inv = store.invoices.find((i) => i.id === invoiceId);
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "cancelled") throw new Error("Invoice is already cancelled");

  inv.status = "cancelled";
  inv.display_status = "cancelled";
  inv.cancel_reason = reason;
  if (inv.amount_paid <= 0) {
    inv.balance_due = 0;
  }

  if (restock) {
    const items = store.invoice_items.filter((it) => it.invoice_id === invoiceId);
    for (const it of items) {
      if (it.frame_model_no) {
        const frame = store.frames.find((f) => f.model_no === it.frame_model_no);
        if (frame) frame.stock_qty += it.qty || 1;
      }
      if (it.lens_code || (it as any).lens_id) {
        const lens = (store.lenses || []).find(
          (l) => l.id === (it as any).lens_id || l.lens_code === it.lens_code,
        );
        if (lens) lens.stock_qty += it.qty || 1;
      }
    }
  }
  saveStore(store);
}

export function creditInvoice(invoiceId: string, reason: string, restock = false): string {
  const store = getStore();
  const inv = store.invoices.find((i) => i.id === invoiceId);
  if (!inv) throw new Error("Invoice not found");
  if (inv.status === "credited") throw new Error("Credit note already issued");

  inv.status = "credited";
  inv.display_status = "credited";
  inv.credit_reason = reason;
  inv.balance_due = 0;
  inv.payment_status = "settled";

  const creditNoteId = crypto.randomUUID();
  const nextSeq = store.invoices.filter((i) => i.type === "credit_note").length + 1;
  const cnNo = `CN-${String(nextSeq).padStart(4, "0")}`;
  const now = new Date().toISOString();

  const creditInvoiceRecord: Invoice = {
    id: creditNoteId,
    shop_id: inv.shop_id,
    order_id: inv.order_id,
    customer_id: inv.customer_id,
    type: "credit_note",
    invoice_no: cnNo,
    financial_year: inv.financial_year,
    status: "finalised",
    display_status: "finalised",
    payment_status: "paid",
    customer_snapshot: inv.customer_snapshot,
    shop_snapshot: inv.shop_snapshot,
    place_of_supply_state_code: inv.place_of_supply_state_code,
    is_interstate: inv.is_interstate,
    subtotal: -inv.subtotal,
    discount_total: -inv.discount_total,
    taxable_total: -inv.taxable_total,
    cgst: -inv.cgst,
    sgst: -inv.sgst,
    igst: -inv.igst,
    round_off: -inv.round_off,
    grand_total: -inv.grand_total,
    amount_paid: 0,
    balance_due: 0,
    refund_due: inv.amount_paid,
    overall_discount_paise: -inv.overall_discount_paise,
    draft_version: 1,
    draft_payments: [],
    created_at: now,
    finalised_at: now,
    original_invoice_id: inv.id,
    credit_reason: reason,
    cancel_reason: null,
  };

  store.invoices.unshift(creditInvoiceRecord);

  // Clone items with negative values
  const origItems = store.invoice_items.filter((it) => it.invoice_id === invoiceId);
  for (const it of origItems) {
    store.invoice_items.push({
      ...it,
      id: crypto.randomUUID(),
      invoice_id: creditNoteId,
      qty: it.qty,
      taxable_paise: -it.taxable_paise,
      cgst_paise: -it.cgst_paise,
      sgst_paise: -it.sgst_paise,
      igst_paise: -it.igst_paise,
    });

    if (restock && it.frame_model_no) {
      const frame = store.frames.find((f) => f.model_no === it.frame_model_no);
      if (frame) frame.stock_qty += it.qty || 1;
    }
    if (restock && (it.lens_code || (it as any).lens_id)) {
      const lens = (store.lenses || []).find(
        (l) => l.id === (it as any).lens_id || l.lens_code === it.lens_code,
      );
      if (lens) lens.stock_qty += it.qty || 1;
    }
  }

  saveStore(store);
  return creditNoteId;
}

export function reversePayment(paymentId: string, reason: string): void {
  const store = getStore();
  const p = store.payments.find((pm) => pm.id === paymentId);
  if (!p) throw new Error("Payment not found");

  const revId = crypto.randomUUID();
  store.payments.push({
    id: revId,
    shop_id: p.shop_id,
    invoice_id: p.invoice_id,
    amount_paise: -p.amount_paise,
    mode: p.mode,
    reference_no: "Refund / Reversal",
    reason,
    reverses_id: p.id,
    paid_at: new Date().toISOString(),
  });

  if (p.invoice_id) {
    const inv = store.invoices.find((i) => i.id === p.invoice_id);
    if (inv) {
      inv.amount_paid -= p.amount_paise;
      inv.balance_due = Math.max(0, inv.grand_total - inv.amount_paid);
      inv.payment_status =
        inv.balance_due <= 0 ? "paid" : inv.amount_paid > 0 ? "partial" : "unpaid";
    }
  }
  saveStore(store);
}

export function removeLensUpload(orderId: string): void {
  const store = getStore();
  const upload = store.uploads.find((u) => u.order_id === orderId);
  if (upload) {
    store.uploads = store.uploads.filter((u) => u.order_id !== orderId);
    const filename = path.basename(upload.storage_path);
    try {
      const localPath = path.join(getUploadsDir(), filename);
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
      const legacyPath = path.join(process.cwd(), "public", upload.storage_path);
      if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
    } catch {}
    if (isCloudStorageEnabled()) {
      void deleteCloudAsset(filename);
    }
    saveStore(store);
  }
}

export function removeBrandImage(kind: "logo" | "signature"): void {
  const store = getStore();
  if (kind === "logo") {
    store.shop.logo_path = null;
  } else {
    store.shop.signature_path = null;
  }
  saveStore(store);
}

export function getMembers(): Profile[] {
  const store = getStore();
  const list = [store.profile];
  if (store.members && Array.isArray(store.members)) {
    for (const m of store.members) {
      if (!list.some((existing) => existing.id === m.id)) {
        list.push(m);
      }
    }
  }
  return list;
}

export function saveMember(member: Partial<Profile>, id?: string): Profile {
  const store = getStore();
  if (!store.members) store.members = [];
  const memberId = id || crypto.randomUUID();

  if (id === store.profile.id) {
    store.profile = {
      ...store.profile,
      full_name: member.full_name || store.profile.full_name,
      role: (member.role as any) || store.profile.role,
      is_active: member.is_active ?? store.profile.is_active,
    };
    saveStore(store);
    return store.profile;
  }

  const existingIdx = store.members.findIndex((m) => m.id === memberId);
  const record: Profile = {
    id: memberId,
    shop_id: store.shop.id,
    full_name: member.full_name || "Team Member",
    role: (member.role as any) || "staff",
    is_active: member.is_active ?? true,
  };
  if (existingIdx >= 0) {
    store.members[existingIdx] = record;
  } else {
    store.members.push(record);
  }
  saveStore(store);
  return record;
}

export function getDataRequests(): DataRequest[] {
  const store = getStore();
  return store.requests || [];
}

export function saveDataRequest(req: Partial<DataRequest>): DataRequest {
  const store = getStore();
  if (!store.requests) store.requests = [];
  const record: DataRequest = {
    id: crypto.randomUUID(),
    customer_id: req.customer_id || "",
    type: req.type || "access",
    status: "open",
    details: req.details || "",
    created_at: new Date().toISOString(),
    handled_at: null,
  };
  store.requests.unshift(record);
  saveStore(store);
  return record;
}

export function resolveDataRequest(id: string, status: string, details?: string): void {
  const store = getStore();
  if (!store.requests) return;
  const req = store.requests.find((r) => r.id === id);
  if (req) {
    req.status = status;
    if (details) req.details = `${req.details} | Resolution: ${details}`;
    req.handled_at = new Date().toISOString();
    saveStore(store);
  }
}

export function eraseCustomerData(requestId: string): void {
  const store = getStore();
  if (!store.requests) return;
  const req = store.requests.find((r) => r.id === requestId);
  if (!req) throw new Error("Data request not found");

  const cust = store.customers.find((c) => c.id === req.customer_id);
  if (cust) {
    cust.name = "Erased Customer";
    cust.phone = "+910000000000";
    cust.alt_phone = null;
    cust.email = null;
    cust.address = null;
    cust.city = null;
    cust.notes = null;
    cust.anonymised_at = new Date().toISOString();
  }

  // Clean uploads for customer orders
  const custOrders = store.orders.filter((o) => o.customer_id === req.customer_id);
  const custOrderIds = new Set(custOrders.map((o) => o.id));
  store.uploads = store.uploads.filter((u) => {
    if (custOrderIds.has(u.order_id)) {
      const filename = path.basename(u.storage_path);
      try {
        const localPath = path.join(getUploadsDir(), filename);
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        const p = path.join(process.cwd(), "public", u.storage_path);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
      if (isCloudStorageEnabled()) {
        void deleteCloudAsset(filename);
      }
      return false;
    }
    return true;
  });

  req.status = "completed";
  req.handled_at = new Date().toISOString();
  saveStore(store);
}
