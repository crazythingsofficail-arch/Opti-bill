/** All monetary inputs/outputs are integer paise. BigInt intermediates avoid float math. */
export function safeInteger(n: number, name = "Amount"): number {
  if (!Number.isSafeInteger(n))
    throw new Error(`${name} must be a safe integer`);
  return n;
}
function toNumber(n: bigint): number {
  const v = Number(n);
  return safeInteger(v);
}
export function roundedRatio(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new Error("Invalid divisor");
  return n < 0n ? -roundedRatio(-n, d) : (n + d / 2n) / d;
}
export function parseMoney(value: string): number {
  const s = value.trim().replaceAll(",", "");
  if (!/^\d+(\.\d{0,2})?$/.test(s))
    throw new Error("Enter an amount with up to two decimal places");
  const [whole, fraction = ""] = s.split(".");
  return toNumber(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
}
export function moneyInput(paise: number): string {
  safeInteger(paise);
  const abs = BigInt(Math.abs(paise));
  return `${paise < 0 ? "-" : ""}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}
export function formatMoney(paise: number): string {
  safeInteger(paise);
  const n = BigInt(Math.abs(paise));
  return `${paise < 0 ? "−" : ""}₹${new Intl.NumberFormat("en-IN").format(n / 100n)}.${String(n % 100n).padStart(2, "0")}`;
}
export function percentDiscount(base: number, basisPoints: number): number {
  safeInteger(base);
  safeInteger(basisPoints);
  if (base < 0 || basisPoints < 0 || basisPoints > 10000)
    throw new Error("Invalid discount");
  return toNumber(roundedRatio(BigInt(base) * BigInt(basisPoints), 10000n));
}
export function allocateDiscount(values: number[], discount: number): number[] {
  values.forEach((v) => {
    safeInteger(v);
    if (v < 0) throw new Error("Negative base");
  });
  safeInteger(discount);
  const sum = values.reduce((n, v) => n + BigInt(v), 0n);
  if (discount < 0 || BigInt(discount) > sum)
    throw new Error("Discount exceeds value");
  if (sum === 0n) return values.map(() => 0);
  const d = BigInt(discount);
  const allocated = values.map((v) => toNumber((BigInt(v) * d) / sum));
  const ranking = values
    .map((v, index) => ({ index, remainder: (BigInt(v) * d) % sum }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.index - b.index
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  const rest = discount - allocated.reduce((a, b) => a + b, 0);
  for (let i = 0; i < rest; i++) allocated[ranking[i].index]++;
  return allocated;
}
export type TaxLine = {
  qty: number;
  unit_price_paise: number;
  discount_paise: number;
  gst_rate_bp: number;
};
export function calculateInvoice(
  lines: TaxLine[],
  overall: number,
  interstate: boolean,
  taxable: boolean,
) {
  const bases = lines.map((l) => {
    [l.qty, l.unit_price_paise, l.discount_paise, l.gst_rate_bp].forEach((v) =>
      safeInteger(v),
    );
    if (
      l.qty < 1 ||
      l.qty > 10000 ||
      l.unit_price_paise < 0 ||
      l.discount_paise < 0 ||
      l.gst_rate_bp < 0 ||
      l.gst_rate_bp > 10000 ||
      l.gst_rate_bp % 2
    )
      throw new Error("Invalid line");
    return (
      toNumber(BigInt(l.qty) * BigInt(l.unit_price_paise)) - l.discount_paise
    );
  });
  const discounts = allocateDiscount(bases, overall);
  const items = lines.map((line, i) => {
    const net = bases[i] - discounts[i];
    const bp = BigInt(taxable ? line.gst_rate_bp : 0);
    const half = toNumber(roundedRatio(BigInt(net) * bp, 20000n));
    const full = toNumber(roundedRatio(BigInt(net) * bp, 10000n));
    return {
      ...line,
      taxable_paise: net,
      discount_paise: line.discount_paise + discounts[i],
      cgst_paise: interstate ? 0 : half,
      sgst_paise: interstate ? 0 : half,
      igst_paise: interstate ? full : 0,
    };
  });
  const sum = (f: (l: (typeof items)[number]) => number) =>
    toNumber(items.reduce((a, l) => a + BigInt(f(l)), 0n));
  const subtotal = sum((l) =>
    toNumber(BigInt(l.qty) * BigInt(l.unit_price_paise)),
  );
  const taxable_total = sum((l) => l.taxable_paise),
    cgst = sum((l) => l.cgst_paise),
    sgst = sum((l) => l.sgst_paise),
    igst = sum((l) => l.igst_paise);
  const before = taxable_total + cgst + sgst + igst;
  const grand_total = toNumber(roundedRatio(BigInt(before), 100n) * 100n);
  return {
    items,
    subtotal,
    discount_total: subtotal - taxable_total,
    taxable_total,
    cgst,
    sgst,
    igst,
    round_off: grand_total - before,
    grand_total,
  };
}
const small = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];
function numberWords(n: number): string {
  if (n < 20) return small[n];
  if (n < 100)
    return tens[Math.floor(n / 10)] + (n % 10 ? ` ${small[n % 10]}` : "");
  for (const [v, label] of [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [100, "Hundred"],
  ] as const) {
    if (n >= v)
      return `${numberWords(Math.floor(n / v))} ${label}${n % v ? ` ${numberWords(n % v)}` : ""}`;
  }
  return "";
}
export function amountInWords(paise: number): string {
  safeInteger(paise);
  const abs = Math.abs(paise);
  return `${paise < 0 ? "Minus " : ""}Rupees ${numberWords(Math.floor(abs / 100))}${abs % 100 ? ` and ${numberWords(abs % 100)} Paise` : ""} Only`;
}
export function financialYear(date: Date, startMonth = 4): string {
  const pieces = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(pieces.find((p) => p.type === "year")!.value),
    month = Number(pieces.find((p) => p.type === "month")!.value);
  const begin = year - (month < startMonth ? 1 : 0);
  return `${String(begin).slice(-2)}-${String(begin + 1).slice(-2)}`;
}
export function invoiceNumber(
  prefix: string,
  fy: string,
  sequence: number,
): string {
  if (
    !/^[A-Z0-9]{1,4}$/.test(prefix) ||
    !/^\d{2}-\d{2}$/.test(fy) ||
    !Number.isSafeInteger(sequence) ||
    sequence < 1
  )
    throw new Error("Invalid series");
  const value = `${prefix}/${fy}/${String(sequence).padStart(4, "0")}`;
  if (value.length > 16) throw new Error("Invoice series exhausted");
  return value;
}
export function gstinValid(value: string): boolean {
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value))
    return false;
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let factor = 2,
    sum = 0;
  for (let i = 13; i >= 0; i--) {
    const n = alphabet.indexOf(value[i]) * factor;
    sum += Math.floor(n / 36) + (n % 36);
    factor = 3 - factor;
  }
  return alphabet[(36 - (sum % 36)) % 36] === value[14];
}
