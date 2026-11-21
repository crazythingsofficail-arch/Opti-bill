import { describe, it, expect } from "vitest";
import {
  allocateDiscount,
  calculateInvoice,
  parseMoney,
  formatMoney,
  amountInWords,
  financialYear,
  invoiceNumber,
  gstinValid,
  percentDiscount,
} from "../../src/lib/money";
import {
  customerSchema,
  prescriptionSchema,
  settingsSchema,
} from "../../src/lib/validation";
describe("integer-paise calculations", () => {
  it("parses decimal strings exactly", () => {
    expect(parseMoney("1,23,456.78")).toBe(12345678);
    expect(parseMoney("0.01")).toBe(1);
    expect(() => parseMoney("1.001")).toThrow();
    expect(() => parseMoney("-1")).toThrow();
    expect(() => parseMoney("NaN")).toThrow();
  });
  it("formats Indian digit groups without floating-point rounding", () => {
    expect(formatMoney(12345678)).toBe("₹1,23,456.78");
    expect(formatMoney(-50)).toBe("−₹0.50");
  });
  it("calculates intra-state GST and rounds only the grand total to rupees", () => {
    const t = calculateInvoice(
      [
        {
          qty: 2,
          unit_price_paise: 10001,
          discount_paise: 2,
          gst_rate_bp: 1800,
        },
      ],
      0,
      false,
      true,
    );
    expect(t).toMatchObject({
      subtotal: 20002,
      discount_total: 2,
      taxable_total: 20000,
      cgst: 1800,
      sgst: 1800,
      igst: 0,
      round_off: 0,
      grand_total: 23600,
    });
  });
  it("calculates interstate IGST", () => {
    const t = calculateInvoice(
      [
        {
          qty: 1,
          unit_price_paise: 19999,
          discount_paise: 99,
          gst_rate_bp: 1200,
        },
      ],
      100,
      true,
      true,
    );
    expect(t).toMatchObject({
      taxable_total: 19800,
      cgst: 0,
      sgst: 0,
      igst: 2376,
      round_off: 24,
      grand_total: 22200,
    });
  });
  it("bills unregistered/composition sales with no tax", () => {
    expect(
      calculateInvoice(
        [
          {
            qty: 1,
            unit_price_paise: 1055,
            discount_paise: 0,
            gst_rate_bp: 1800,
          },
        ],
        0,
        false,
        false,
      ),
    ).toMatchObject({
      cgst: 0,
      sgst: 0,
      igst: 0,
      round_off: 45,
      grand_total: 1100,
    });
  });
  it("uses deterministic largest-remainder allocations", () => {
    expect(allocateDiscount([100, 100, 100], 2)).toEqual([1, 1, 0]);
    expect(allocateDiscount([0, 100], 10)).toEqual([0, 10]);
    expect(allocateDiscount([0], 0)).toEqual([0]);
    expect(() => allocateDiscount([100], 101)).toThrow();
  });
  it("keeps all randomized totals reconciled to the paisa", () => {
    let seed = 17;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed;
    };
    for (let i = 0; i < 300; i++) {
      const lines = Array.from({ length: 1 + (rand() % 20) }, () => ({
        qty: 1 + (rand() % 5),
        unit_price_paise: rand() % 1000000,
        discount_paise: 0,
        gst_rate_bp: [0, 500, 1200, 1800, 2800][rand() % 5],
      }));
      const total = lines.reduce((n, l) => n + l.qty * l.unit_price_paise, 0);
      const discount = rand() % (total + 1);
      const t = calculateInvoice(lines, discount, Boolean(rand() % 2), true);
      expect(t.grand_total).toBe(
        t.taxable_total + t.cgst + t.sgst + t.igst + t.round_off,
      );
      expect(t.grand_total % 100).toBe(0);
      expect(t.discount_total).toBe(discount);
      expect(Math.abs(t.round_off)).toBeLessThanOrEqual(50);
    }
  });
  it("handles 100% discounts and rejects invalid inputs", () => {
    expect(
      calculateInvoice(
        [
          {
            qty: 1,
            unit_price_paise: 10000,
            discount_paise: 0,
            gst_rate_bp: 1800,
          },
        ],
        10000,
        false,
        true,
      ).grand_total,
    ).toBe(0);
    expect(() =>
      calculateInvoice(
        [
          {
            qty: 1.5,
            unit_price_paise: 1,
            discount_paise: 0,
            gst_rate_bp: 1800,
          },
        ],
        0,
        false,
        true,
      ),
    ).toThrow();
    expect(() => parseMoney("999999999999999999999")).toThrow();
    expect(percentDiscount(101, 5000)).toBe(51);
  });
});
describe("formatting and identity", () => {
  it("converts lakh/crore and paise to words", () => {
    expect(amountInWords(123456789)).toBe(
      "Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Eighty Nine Paise Only",
    );
    expect(amountInWords(1000000000)).toBe("Rupees One Crore Only");
    expect(amountInWords(0)).toBe("Rupees Zero Only");
  });
  it("changes financial years at midnight in India", () => {
    expect(financialYear(new Date("2026-03-31T18:29:59Z"))).toBe("25-26");
    expect(financialYear(new Date("2026-03-31T18:30:00Z"))).toBe("26-27");
  });
  it("enforces invoice length and allowed series", () => {
    expect(invoiceNumber("OX", "26-27", 1)).toBe("OX/26-27/0001");
    expect(() => invoiceNumber("INVXX", "26-27", 1)).toThrow();
    expect(() => invoiceNumber("ABCD", "26-27", 1000000)).toThrow();
  });
  it("validates GSTIN checksum", () => {
    expect(gstinValid("27AAPFU0939F1ZV")).toBe(true);
    expect(gstinValid("27AAPFU0939F1ZA")).toBe(false);
    expect(gstinValid("bad")).toBe(false);
  });
});
describe("clinical and consent validation", () => {
  const rx: Record<string, unknown> = {
    customer_id: "10000000-0000-4000-8000-000000000001",
    test_date: "2026-01-01",
    examiner_name: "Test Examiner",
    source: "in_shop",
    bin_pd: null,
    vertex_distance: null,
    pantoscopic_tilt: null,
    remarks: "",
    valid_until: null,
  };
  for (const eye of ["od", "os"])
    for (const metric of [
      "sph",
      "cyl",
      "axis",
      "add_power",
      "prism",
      "base",
      "pd_distance",
      "pd_near",
      "seg_height",
      "va_unaided",
      "va_aided",
    ])
      rx[`${eye}_${metric}`] = null;
  it("accepts quarter-dioptre prescriptions", () =>
    expect(
      prescriptionSchema.safeParse({
        ...rx,
        od_sph: 1.25,
        od_cyl: -0.5,
        od_axis: 180,
      }).success,
    ).toBe(true));
  it("requires cylinder axis and rejects unusual step sizes", () => {
    expect(
      prescriptionSchema.safeParse({ ...rx, od_cyl: -1, od_axis: null })
        .success,
    ).toBe(false);
    expect(prescriptionSchema.safeParse({ ...rx, os_sph: 1.1 }).success).toBe(
      false,
    );
    expect(
      prescriptionSchema.safeParse({ ...rx, od_add_power: 0 }).success,
    ).toBe(false);
  });
  it("does not accept a minor without verified guardian consent", () => {
    expect(
      customerSchema.safeParse({
        name: "Test Child",
        phone: "+919000000008",
        gender: "undisclosed",
        age_years: 10,
        consent_given: true,
        guardian_consent: false,
      }).success,
    ).toBe(false);
  });
  it("requires complete published policies", () =>
    expect(settingsSchema.safeParse({}).success).toBe(false));
});
