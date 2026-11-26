import { z } from "zod";
import { gstinValid } from "./money";
import { validPolicyTokens } from "./legal-format";
export const uuid = z.uuid();
export const phone = z
  .string()
  .trim()
  .transform((v) => {
    const digits = v.replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    return v;
  })
  .refine((v) => /^\+91[6-9][0-9]{9}$/.test(v), "Enter a valid 10-digit mobile number");
const text = z.string().trim().max(5000);
const optionalText = text.nullish().transform((v) => v ?? "");
const optionalGstin = z
  .string()
  .nullish()
  .transform((v) => v?.trim().toUpperCase() || "")
  .refine((v) => !v || gstinValid(v), "Invalid GSTIN or checksum");
export const money = z.number().int().min(0).max(100000000000000);
const date = z.iso.date();
export const loginSchema = z
  .object({
    username: z.string().trim().min(1).max(128).optional(),
    user: z.string().trim().min(1).max(128).optional(),
    email: z.string().trim().min(1).max(128).optional(),
    password: z.string().min(1).max(128),
  })
  .transform((val, ctx) => {
    const identifier = val.username || val.user || val.email || "";
    if (!identifier) {
      ctx.addIssue({
        code: "custom",
        message: "User is required",
        path: ["username"],
      });
      return z.NEVER;
    }
    return { identifier, password: val.password };
  });
export const signupSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[0-9]/, "Include a number"),
});
export const setupSchema = z
  .object({
    full_name: z.string().min(2).max(100),
    name: z.string().min(2).max(120),
    legal_name: z.string().min(2),
    gstin: optionalGstin,
    address: z.string().min(4),
    city: z.string().min(2),
    state: z.string().min(2),
    state_code: z.string().regex(/^\d{2}$/),
    pincode: z.string().regex(/^\d{6}$/),
    phone,
    email: z.email(),
    gst_scheme: z.enum(["regular", "composition", "unregistered"]),
    invoice_prefix: z.string().regex(/^[A-Z0-9]{1,4}$/),
    invoice_recipient_threshold_paise: money,
  })
  .refine((p) => p.gst_scheme === "unregistered" || !!p.gstin, {
    message: "GSTIN is required for a registered shop",
    path: ["gstin"],
  })
  .refine((p) => !p.gstin || p.gstin.startsWith(p.state_code), {
    message: "GSTIN must match the state",
    path: ["gstin"],
  });
export const settingsSchema = z
  .object({
    ...setupSchema.shape,
    address: z.string().max(500),
    city: z.string().max(120),
    state: z.string().max(120),
    state_code: z
      .string()
      .refine((v) => !v || /^\d{2}$/.test(v), "State code must be 2 digits"),
    pincode: z
      .string()
      .refine((v) => !v || /^\d{6}$/.test(v), "PIN code must be 6 digits"),
  })
  .omit({ full_name: true })
  .extend({
    terms_text: text,
    warranty_text: text,
    return_policy_text: text,
    composition_declaration: text,
    reverse_charge_text: text,
    privacy_text: z
      .string()
      .min(10)
      .max(30000)
      .refine(validPolicyTokens, "Unknown privacy policy field"),
    privacy_version: z.string().min(1).max(50),
    terms_of_use_text: z
      .string()
      .min(10)
      .max(30000)
      .refine(validPolicyTokens, "Unknown terms field"),
    consent_text: z.string().min(20).max(3000),
    grievance_name: z.string().min(2),
    grievance_email: z.email(),
    retention_months: z.number().int().min(72).max(600),
    clinical_retention_months: z.number().int().min(1).max(600),
    hsn_digits: z.union([z.literal(4), z.literal(6)]),
    upi_id: z.string().max(100).nullable(),
    bank_details: optionalText,
    einvoice_enabled: z.boolean(),
  })
  .refine((p) => p.gst_scheme === "unregistered" || !!p.gstin, {
    message: "GSTIN is required for a registered shop",
    path: ["gstin"],
  })
  .refine(
    (p) =>
      p.gst_scheme === "unregistered" ||
      (!!p.state_code && (!p.gstin || p.gstin.startsWith(p.state_code))),
    {
      message: "GSTIN must match the state code",
      path: ["gstin"],
    },
  );
export const normalizeStateCode = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  const s = String(val).trim();
  if (!s) return "";
  if (/^\d{2}$/.test(s)) return s;
  if (/^\d$/.test(s)) return `0${s}`;
  const lower = s.toLowerCase();
  const map: Record<string, string> = {
    jammu: "01",
    kashmir: "01",
    jk: "01",
    himachal: "02",
    hp: "02",
    punjab: "03",
    pb: "03",
    chandigarh: "04",
    ch: "04",
    uttarakhand: "05",
    uk: "05",
    haryana: "06",
    hr: "06",
    delhi: "07",
    dl: "07",
    rajasthan: "08",
    rj: "08",
    "uttar pradesh": "09",
    up: "09",
    bihar: "10",
    br: "10",
    sikkim: "11",
    sk: "11",
    arunachal: "12",
    ar: "12",
    nagaland: "13",
    nl: "13",
    manipur: "14",
    mn: "14",
    mizoram: "15",
    mz: "15",
    tripura: "16",
    tr: "16",
    meghalaya: "17",
    ml: "17",
    assam: "18",
    as: "18",
    "west bengal": "19",
    bengal: "19",
    wb: "19",
    jharkhand: "20",
    jh: "20",
    odisha: "21",
    orissa: "21",
    od: "21",
    chhattisgarh: "22",
    cg: "22",
    "madhya pradesh": "23",
    mp: "23",
    gujarat: "24",
    gj: "24",
    maharashtra: "27",
    mh: "27",
    karnataka: "29",
    bangalore: "29",
    bengaluru: "29",
    ka: "29",
    goa: "30",
    ga: "30",
    kerala: "32",
    kl: "32",
    "tamil nadu": "33",
    tamilnadu: "33",
    tn: "33",
    chennai: "33",
    telangana: "36",
    hyderabad: "36",
    ts: "36",
    tg: "36",
    andhra: "37",
    "andhra pradesh": "37",
    ap: "37",
  };
  for (const [key, code] of Object.entries(map)) {
    if (lower.includes(key)) return code;
  }
  return "29";
};

export const customerSchema = z
  .object({
    name: z.string().min(2).max(120),
    phone,
    alt_phone: z.union([phone, z.literal("")]).nullish(),
    gender: z.enum(["male", "female", "other", "undisclosed"]),
    dob: date.nullish(),
    age_years: z.number().int().min(0).max(130).nullish(),
    email: z.union([z.email(), z.literal("")]).nullish(),
    address: optionalText,
    city: optionalText,
    state_code: z.unknown().transform(normalizeStateCode),
    gstin: optionalGstin,
    notes: optionalText,
    consent_given: z.unknown().transform(() => true as const),
    guardian_name: optionalText,
    guardian_phone: optionalText,
    guardian_consent: z.boolean().nullish().transform(Boolean),
    guardian_verification: optionalText,
  })
  .superRefine((c, ctx) => {
    if (c.dob && c.age_years != null)
      ctx.addIssue({
        code: "custom",
        message: "Use age or date of birth",
        path: ["age_years"],
      });
    const today = new Date();
    const dob = c.dob ? new Date(c.dob + "T00:00:00Z") : null;
    let age = c.age_years;
    if (dob) {
      age = today.getUTCFullYear() - dob.getUTCFullYear();
      if (
        today.getUTCMonth() < dob.getUTCMonth() ||
        (today.getUTCMonth() === dob.getUTCMonth() &&
          today.getUTCDate() < dob.getUTCDate())
      )
        age--;
    }
    if (age == null || age < 0)
      ctx.addIssue({
        code: "custom",
        message: "Enter age or valid date of birth",
        path: ["age_years"],
      });
    if (
      age != null &&
      age < 18 &&
      (!c.guardian_consent ||
        c.guardian_name.length < 2 ||
        !phone.safeParse(c.guardian_phone).success ||
        c.guardian_verification.length < 3)
    )
      ctx.addIssue({
        code: "custom",
        message: "Guardian name, phone, verification and consent are required",
        path: ["guardian_consent"],
      });
    if (c.gstin && (!c.state_code || !c.gstin.startsWith(c.state_code)))
      ctx.addIssue({
        code: "custom",
        message: "GSTIN must match customer state",
        path: ["gstin"],
      });
  });
const quarter = z.number().min(-30).max(30).multipleOf(0.25).nullish().transform((v) => v ?? null);
const eyeShape = {
  sph: quarter,
  cyl: quarter,
  axis: z.number().int().min(1).max(180).nullish().transform((v) => v ?? null),
  add_power: z.number().min(0.25).max(4).multipleOf(0.25).nullish().transform((v) => v ?? null),
  prism: z.number().min(0).max(30).nullish().transform((v) => v ?? null),
  base: z.string().max(30).nullish().transform((v) => v ?? null),
  pd_distance: z.number().min(10).max(45).nullish().transform((v) => v ?? null),
  pd_near: z.number().min(10).max(45).nullish().transform((v) => v ?? null),
  seg_height: z.number().min(0).max(60).nullish().transform((v) => v ?? null),
  va_unaided: z.string().max(30).nullish().transform((v) => v ?? null),
  va_aided: z.string().max(30).nullish().transform((v) => v ?? null),
};
const eyeFields = Object.fromEntries(
  ["od", "os"].flatMap((e) =>
    Object.entries(eyeShape).map(([k, v]) => [`${e}_${k}`, v]),
  ),
) as unknown as Record<
  `${"od" | "os"}_${keyof typeof eyeShape}`,
  z.ZodType<number | string | null>
>;
export const prescriptionSchema = z
  .object({
    customer_id: uuid,
    test_date: date,
    examiner_name: z.string().min(1).max(120),
    source: z.string().default("in_shop"),
    ...eyeFields,
    bin_pd: z.number().min(20).max(90).nullish().transform((v) => v ?? null),
    vertex_distance: z.number().min(0).max(30).nullish().transform((v) => v ?? null),
    pantoscopic_tilt: z.number().min(-30).max(30).nullish().transform((v) => v ?? null),
    remarks: optionalText,
    valid_until: date.nullish().transform((v) => v ?? null),
  })
  .superRefine((v, ctx) => {
    for (const eye of ["od", "os"] as const)
      if (v[`${eye}_cyl`] && v[`${eye}_axis`] == null)
        ctx.addIssue({
          code: "custom",
          message: "Axis is required when cylinder is non-zero",
          path: [`${eye}_axis`],
        });
    if (v.valid_until && v.valid_until < v.test_date)
      ctx.addIssue({
        code: "custom",
        message: "Validity must follow the test date",
        path: ["valid_until"],
      });
  });
export const taxSchema = z.object({
  name: z.string().min(2).max(100),
  hsn_code: z.string().regex(/^(\d{4}|\d{6}|\d{8})$/),
  gst_rate_bp: z.number().int().min(0).max(10000).multipleOf(2),
  effective_from: date,
  is_active: z.boolean(),
});
export const frameSchema = z.object({
  model_no: z.string().min(1).max(100),
  brand: text,
  colour: text.nullish().transform((v) => v || ""),
  size: text.nullish().transform((v) => v || ""),
  material: text.nullish().transform((v) => v || ""),
  type: z
    .enum(["", "full rim", "half rim", "rimless"])
    .nullish()
    .transform((v) => v || ""),
  gender_target: text.nullish().transform((v) => v || ""),
  cost_paise: money.nullish().transform((v) => v ?? 0),
  mrp_paise: money,
  stock_qty: z.number().int().min(0).max(1000000),
});
export const lensSchema = z.object({
  lens_code: z.string().min(1).max(100),
  brand: z.string().min(1).max(100),
  name: text,
  lens_type: z.enum([
    "single vision",
    "bifocal",
    "progressive",
    "office / computer",
  ]),
  lens_index: z.string().min(1).max(50),
  coatings: text.nullish().transform((v) => v || "Anti-Glare (ARC)"),
  tint: text.nullish().transform((v) => v || "Clear"),
  dia_mm: text.nullish().transform((v) => v || ""),
  sph_range: text.nullish().transform((v) => v || ""),
  cyl_range: text.nullish().transform((v) => v || ""),
  cost_paise: money.nullish().transform((v) => v ?? 0),
  mrp_paise: money,
  stock_qty: z.number().int().min(0).max(1000000),
  hsn_code: text.nullish().transform((v) => v || "9001"),
});
export const itemSchema = z
  .object({
    item_type: z.enum([
      "frame",
      "lens",
      "contact_lens",
      "sunglass",
      "accessory",
      "service",
      "other",
    ]),
    description: z.string().min(1).max(500),
    frame_id: uuid.nullish(),
    frame_model_no: optionalText,
    lens_id: uuid.nullish(),
    lens_brand: optionalText,
    lens_code: optionalText,
    lens_type: optionalText,
    lens_index: optionalText,
    coatings: optionalText,
    tint: optionalText,
    qty: z.number().int().min(1).max(10000),
    unit: z.string().min(1).max(20),
    unit_price_paise: money.max(10000000000),
    discount_paise: money,
    tax_category_id: uuid,
  })
  .refine(
    (l) => l.discount_paise <= l.qty * l.unit_price_paise,
    "Line discount exceeds value",
  );
export const splitPaymentSchema = z.object({
  amount_paise: money.min(1),
  mode: z.enum(["cash", "upi", "card", "bank", "other"]),
  reference_no: text.default(""),
  idempotency_key: uuid.optional().default(() => crypto.randomUUID()),
});
export const draftSchema = z.object({
  id: uuid,
  expected_version: z
    .unknown()
    .transform((v) => {
      const n = Number(v);
      return !isNaN(n) && n >= 0 ? Math.floor(n) : 0;
    }),
  customer_id: uuid,
  prescription_id: uuid.nullish().transform((v) => v ?? null),
  place_of_supply_state_code: z
    .unknown()
    .transform((v) => normalizeStateCode(v)),
  overall_discount_paise: money.nullish().transform((v) => v ?? 0),
  promised_date: date.nullish().transform((v) => v ?? null),
  notes: text.nullish().transform((v) => v ?? ""),
  items: z.array(itemSchema).max(100).default([]),
  payments: z.array(splitPaymentSchema).max(10).default([]),
});
export const finaliseSchema = z.object({
  id: uuid,
  key: uuid,
  payments: z.array(splitPaymentSchema).max(10),
});
export const paymentSchema = splitPaymentSchema.extend({ invoice_id: uuid });
export const orderSchema = z.object({
  id: uuid,
  status: z.enum([
    "Ordered",
    "Sent to lab",
    "Received from lab",
    "Ready",
    "Delivered",
  ]),
  lab_name: text,
  promised_date: date.nullable(),
});
export const correctionSchema = z.object({
  id: uuid,
  reason: z.string().trim().min(3).max(1000),
  key: uuid,
  restock: z.boolean().default(false),
});
