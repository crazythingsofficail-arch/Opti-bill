"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Printer, Check, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { api, displayDate, today } from "@/lib/client";
import { calculateInvoice, formatMoney, parseMoney } from "@/lib/money";
import type { Customer, Frame, Lens, TaxCategory, OrderItem } from "@/lib/types";
import { useWorkspace, useToast } from "./providers";
import {
  PageTitle,
  Card,
  Button,
  Field,
  Input,
  SegmentedControl,
  Badge,
} from "./ui";

const LENS_TYPES = ["single vision", "bifocal", "progressive", "office / computer"];
const LENS_INDICES = [
  "1.50 Standard",
  "1.56 Thin",
  "1.59 Polycarbonate",
  "1.60 Extra Thin",
  "1.67 Ultra Thin",
  "1.74 High Index",
  "Trivex",
  "Mineral Glass",
];
const COATINGS_LIST = [
  "Anti-Glare (ARC)",
  "Blue Cut / Computer",
  "Hard Coat (Scratch Resistant)",
  "Hydrophobic / Dust Resistant",
  "Super Hydrophobic",
  "UV400 Protection",
];
const TINT_LIST = [
  "Clear",
  "Photochromic / Transitions (Grey)",
  "Photochromic / Transitions (Brown)",
  "Polarized (Grey)",
  "Polarized (Brown)",
  "Tinted (Sun)",
];
const PAYMENT_MODES = [
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["card", "Card"],
  ["bank", "Bank"],
  ["other", "Other"],
] as const;

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function OrderBooking() {
  const { shop } = useWorkspace();
  const toast = useToast();
  const searchParams = useSearchParams();

  // Customer fields
  const [customerId, setCustomerId] = useState<string | null>(
    searchParams.get("customer") || null,
  );
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAge, setCustAge] = useState("");
  const [custCity, setCustCity] = useState("");
  const [debouncedLookup, setDebouncedLookup] = useState("");

  // Mode: Frame + Lens | Frame only | Lens only
  const [mode, setMode] = useState("Frame + Lens");

  // Expandable progressive disclosure toggles
  const [showMoreFrame, setShowMoreFrame] = useState(false);
  const [showMoreLens, setShowMoreLens] = useState(false);
  const [showRx, setShowRx] = useState(false);
  const [showMoreBooking, setShowMoreBooking] = useState(false);

  // Frame parameters (all optional)
  const [frameId, setFrameId] = useState("");
  const [frameBrand, setFrameBrand] = useState("");
  const [frameModel, setFrameModel] = useState("");
  const [frameColour, setFrameColour] = useState("");
  const [frameSize, setFrameSize] = useState("");
  const [frameMaterial, setFrameMaterial] = useState("");
  const [frameType, setFrameType] = useState("");
  const [framePrice, setFramePrice] = useState("");
  const [frameQty, setFrameQty] = useState(1);

  // Lens parameters (all optional)
  const [lensId, setLensId] = useState("");
  const [lensBrand, setLensBrand] = useState("");
  const [lensName, setLensName] = useState("");
  const [lensCode, setLensCode] = useState("");
  const [lensType, setLensType] = useState("");
  const [lensIndex, setLensIndex] = useState("");
  const [coatings, setCoatings] = useState("");
  const [tint, setTint] = useState("");
  const [diaMm, setDiaMm] = useState("");
  const [sphRange, setSphRange] = useState("");
  const [cylRange, setCylRange] = useState("");
  const [lensPrice, setLensPrice] = useState("");
  const [lensQty, setLensQty] = useState(1);

  // Optional prescription parameters
  const [odSph, setOdSph] = useState("");
  const [odCyl, setOdCyl] = useState("");
  const [odAxis, setOdAxis] = useState("");
  const [odAdd, setOdAdd] = useState("");
  const [osSph, setOsSph] = useState("");
  const [osCyl, setOsCyl] = useState("");
  const [osAxis, setOsAxis] = useState("");
  const [osAdd, setOsAdd] = useState("");
  const [binPd, setBinPd] = useState("");
  const [rxExaminer, setRxExaminer] = useState("");
  const [rxSourceType, setRxSourceType] = useState<"in_shop" | "external">("in_shop");
  const [rxSourceName, setRxSourceName] = useState("");

  // Payment & delivery
  const [taxCategoryId, setTaxCategoryId] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "bank" | "other">("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [labName, setLabName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Lookup existing customers quietly from whatever user types into phone or name
  const lookupText = custPhone.trim().length >= 3 ? custPhone.trim() : custName.trim();
  useEffect(() => {
    const t = setTimeout(() => setDebouncedLookup(lookupText), 250);
    return () => clearTimeout(t);
  }, [lookupText]);

  const customerQuery = useQuery({
    queryKey: ["booking-cust-search", debouncedLookup],
    queryFn: () =>
      api<{ rows: Customer[] }>(`customers?q=${encodeURIComponent(debouncedLookup)}`),
    enabled: !customerId && debouncedLookup.trim().length >= 2,
  });

  const framesQuery = useQuery({
    queryKey: ["booking-frames"],
    queryFn: () => api<{ rows: Frame[] }>("frames"),
  });

  const lensesQuery = useQuery({
    queryKey: ["booking-lenses"],
    queryFn: () => api<{ rows: Lens[] }>("lenses"),
  });

  const taxesQuery = useQuery({
    queryKey: ["booking-taxes"],
    queryFn: () => api<{ rows: TaxCategory[] }>("active-taxes"),
  });

  const currentTaxes = (taxesQuery.data?.rows || [])
    .filter((t) => t.is_active && t.effective_from <= today())
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from));

  const effectiveTaxId = taxCategoryId || currentTaxes[0]?.id || "";

  useEffect(() => {
    const cid = searchParams.get("customer");
    if (cid) {
      void api<{ rows: Customer[] }>(`customers?id=${encodeURIComponent(cid)}`)
        .then((r) => {
          const c = r.rows?.[0];
          if (c) {
            setCustomerId(c.id);
            setCustName(c.name || "");
            setCustPhone(c.phone || "");
            setCustAge(c.age_years != null ? String(c.age_years) : "");
            setCustCity(c.city || "");
          }
        })
        .catch(() => undefined);
    }
  }, [searchParams]);

  function pickExistingCustomer(c: Customer) {
    setCustomerId(c.id);
    setCustName(c.name || "");
    setCustPhone(c.phone || "");
    setCustAge(c.age_years != null ? String(c.age_years) : "");
    setCustCity(c.city || "");
  }

  function clearCustomerSelection() {
    setCustomerId(null);
    setCustName("");
    setCustPhone("");
    setCustAge("");
    setCustCity("");
  }

  function handleSelectFrame(id: string) {
    setFrameId(id);
    const f = framesQuery.data?.rows.find((x) => x.id === id);
    if (f) {
      setFrameBrand(f.brand || "");
      setFrameModel(f.model_no || "");
      setFrameColour(f.colour || "");
      setFrameSize(f.size || "");
      setFrameMaterial(f.material || "");
      setFrameType(f.type || "");
      setFramePrice(f.mrp_paise ? String(f.mrp_paise / 100) : "");
    }
  }

  function handleSelectLens(id: string) {
    setLensId(id);
    const l = lensesQuery.data?.rows.find((x) => x.id === id);
    if (l) {
      setLensBrand(l.brand || "");
      setLensName(l.name || "");
      setLensCode(l.lens_code || "");
      setLensType(l.lens_type || "");
      setLensIndex(l.lens_index || "");
      setCoatings(l.coatings || "");
      setTint(l.tint || "");
      setDiaMm(l.dia_mm || "");
      setSphRange(l.sph_range || "");
      setCylRange(l.cyl_range || "");
      setLensPrice(l.mrp_paise ? String(l.mrp_paise / 100) : "");
    }
  }

  function buildOrderItems(): OrderItem[] {
    const items: OrderItem[] = [];
    const includeFrame = mode === "Frame + Lens" || mode === "Frame only";
    const includeLens = mode === "Frame + Lens" || mode === "Lens only";

    if (includeFrame) {
      const fPrice = parseMoney(framePrice || "0");
      const fSpecs: Record<string, string | null> = {
        ...(frameBrand ? { brand: frameBrand } : {}),
        ...(frameColour ? { colour: frameColour } : {}),
        ...(frameSize ? { size: frameSize } : {}),
        ...(frameMaterial ? { material: frameMaterial } : {}),
        ...(frameType ? { type: frameType } : {}),
      };
      const fDesc =
        [frameBrand, frameModel, frameColour].filter(Boolean).join(" · ") ||
        "Booked Frame";
      items.push({
        item_type: "frame",
        description: fDesc,
        specs: fSpecs,
        frame_id: frameId || null,
        frame_model_no: frameModel || "",
        lens_brand: "",
        lens_code: "",
        lens_type: "",
        lens_index: "",
        coatings: "",
        tint: "",
        qty: Math.max(1, Number(frameQty) || 1),
        unit: "piece",
        unit_price_paise: fPrice,
        discount_paise: 0,
        tax_category_id: effectiveTaxId,
      });
    }

    if (includeLens) {
      const lPrice = parseMoney(lensPrice || "0");
      const lSpecs: Record<string, string | null> = {
        ...(lensName ? { product: lensName } : {}),
        ...(diaMm ? { dia_mm: `${diaMm}mm` } : {}),
        ...(sphRange ? { sph_range: sphRange } : {}),
        ...(cylRange ? { cyl_range: cylRange } : {}),
      };
      const lDesc =
        [lensBrand, lensName || lensType, lensIndex, coatings]
          .filter(Boolean)
          .join(" · ") || "Booked Optical Lens";
      items.push({
        item_type: "lens",
        description: lDesc,
        specs: lSpecs,
        frame_model_no: "",
        lens_id: lensId || null,
        lens_brand: lensBrand || "",
        lens_code: lensCode || "",
        lens_type: lensType || "",
        lens_index: lensIndex || "",
        coatings: coatings || "",
        tint: tint || "",
        qty: Math.max(1, Number(lensQty) || 1),
        unit: "pair",
        unit_price_paise: lPrice,
        discount_paise: 0,
        tax_category_id: effectiveTaxId,
      });
    }

    return items;
  }

  let previewTotals: ReturnType<typeof calculateInvoice> | null = null;
  let advancePaise = 0;
  let calcErr = "";
  try {
    advancePaise = parseMoney(advanceAmount || "0");
    if (effectiveTaxId) {
      const taxRate =
        currentTaxes.find((t) => t.id === effectiveTaxId)?.gst_rate_bp ?? 0;
      const items = buildOrderItems();
      previewTotals = calculateInvoice(
        items.map((it) => ({
          qty: it.qty,
          unit_price_paise: it.unit_price_paise,
          discount_paise: it.discount_paise,
          gst_rate_bp: taxRate,
        })),
        0,
        false,
        shop.gst_scheme === "regular",
      );
    }
  } catch (e) {
    calcErr = e instanceof Error ? e.message : "Check numeric amounts";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError("");
      setBusy(true);
      if (!effectiveTaxId) {
        throw new Error("Configure at least one active tax category in Settings first");
      }
      if (!custName.trim()) throw new Error("Enter customer name");
      if (!custPhone.trim()) throw new Error("Enter customer phone number");

      const items = buildOrderItems();
      const adv = parseMoney(advanceAmount || "0");
      if (previewTotals && adv > previewTotals.grand_total) {
        throw new Error("Advance payment cannot exceed total amount");
      }

      const numOrNull = (val: string) =>
        val.trim() === "" || isNaN(Number(val)) ? null : Number(val);

      const hasRx = [odSph, odCyl, odAdd, osSph, osCyl, osAdd, binPd].some(
        (x) => x.trim() !== "",
      );

      const rxSource = rxSourceName.trim()
        ? rxSourceType === "external"
          ? `External: ${rxSourceName.trim()}`
          : `In shop: ${rxSourceName.trim()}`
        : rxSourceType;

      const payload = {
        customer_id: customerId,
        customer: {
          name: custName.trim(),
          phone: custPhone.trim(),
          age_years: custAge.trim() ? Number(custAge) : null,
          city: custCity.trim(),
        },
        prescription: hasRx
          ? {
              examiner_name: rxExaminer.trim() || "Optometrist",
              source: rxSource,
              od_sph: numOrNull(odSph),
              od_cyl: numOrNull(odCyl),
              od_axis: numOrNull(odAxis),
              od_add_power: numOrNull(odAdd),
              os_sph: numOrNull(osSph),
              os_cyl: numOrNull(osCyl),
              os_axis: numOrNull(osAxis),
              os_add_power: numOrNull(osAdd),
              bin_pd: numOrNull(binPd),
            }
          : null,
        items,
        advance_paise: adv,
        payment_mode: paymentMode,
        reference_no: referenceNo.trim(),
        promised_date: promisedDate || null,
        lab_name: labName.trim(),
        notes: notes.trim(),
      };

      const res = await api<{ orderId: string; invoiceId: string; customerId: string }>(
        "book-order",
        payload,
      );
      toast("Booking Bill ready");
      window.location.assign(`/print/${res.invoiceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to book order");
      setBusy(false);
    }
  }

  const grandTotal = previewTotals?.grand_total || 0;
  const remainingPaise = Math.max(0, grandTotal - advancePaise);
  const matchingCustomers = !customerId ? (customerQuery.data?.rows || []).slice(0, 4) : [];

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <PageTitle
        eyebrow="STEP 1 · ORDER BOOKING"
        title="Book Order"
        description="Quickly enter customer name, phone, frame or lens selection, and advance paid."
        action={
          <Link href="/orders" className="button secondary">
            <ArrowLeft size={16} />
            Pending pickups
          </Link>
        }
      />

      {error && (
        <div className="notice error-text" role="alert" style={{ marginBottom: 18 }}>
          {error}
        </div>
      )}

      <div className="wizard-layout">
        <div className="stack">
          {/* 1. Customer — single streamlined row with inline autosuggest */}
          <Card>
            <div className="card-heading">
              <div>
                <h2>1. Customer</h2>
                <p className="section-note">
                  Enter Name and Phone — if they have visited before, tap their name to autofill.
                </p>
              </div>
              {customerId && (
                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                  <Badge>Returning customer</Badge>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={clearCustomerSelection}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: "2fr 1.6fr 1fr" }}>
              <Field label="Name *">
                <Input
                  value={custName}
                  onChange={(e) => {
                    setCustName(e.target.value);
                    if (customerId) setCustomerId(null);
                  }}
                  placeholder="Customer full name"
                  required
                />
              </Field>
              <Field label="Phone number *">
                <Input
                  type="tel"
                  value={custPhone}
                  onChange={(e) => {
                    setCustPhone(e.target.value);
                    if (customerId) setCustomerId(null);
                  }}
                  placeholder="10-digit mobile"
                  required
                />
              </Field>
              <Field label="Age (optional)">
                <Input
                  type="number"
                  min={0}
                  max={130}
                  value={custAge}
                  onChange={(e) => setCustAge(e.target.value)}
                  placeholder="Years"
                />
              </Field>
            </div>

            {matchingCustomers.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <small className="muted" style={{ display: "block", marginBottom: 6 }}>
                  Existing customer match (tap to autofill):
                </small>
                <div className="row wrap" style={{ gap: 8 }}>
                  {matchingCustomers.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className="button secondary"
                      style={{ minHeight: 38, padding: "6px 12px", fontSize: 12 }}
                      onClick={() => pickExistingCustomer(c)}
                    >
                      <Check size={14} />
                      {c.name} · {c.phone}
                      {c.age_years != null ? ` (${c.age_years}y)` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* 2. Frame / Lens / Both — Essential fields up front, optional extras tucked neatly */}
          <Card>
            <div className="card-heading">
              <div>
                <h2>2. Frame / Lens Selection</h2>
                <p className="section-note">
                  All parameters are optional — fill only what you need.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <SegmentedControl
                values={["Frame + Lens", "Frame only", "Lens only"]}
                value={mode}
                onChange={setMode}
              />
            </div>

            {(mode === "Frame + Lens" || mode === "Frame only") && (
              <div style={{ marginBottom: 22 }}>
                <div className="row between" style={{ marginBottom: 10, alignItems: "center" }}>
                  <h3 style={{ fontSize: 15 }}>Frame</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowMoreFrame((v) => !v)}
                  >
                    {showMoreFrame ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    {showMoreFrame ? "Hide extra frame specs" : "+ More frame specs"}
                  </Button>
                </div>

                <div className="form-grid" style={{ gridTemplateColumns: "1.4fr 1.2fr 1fr" }}>
                  <Field label="Brand / Name">
                    <Input
                      value={frameBrand}
                      onChange={(e) => setFrameBrand(e.target.value)}
                      placeholder="e.g. Ray-Ban, Titan"
                    />
                  </Field>
                  <Field label="Model / SKU">
                    <Input
                      value={frameModel}
                      onChange={(e) => setFrameModel(e.target.value)}
                      placeholder="e.g. RB3025"
                    />
                  </Field>
                  <Field label="Frame Price (₹)">
                    <Input
                      inputMode="decimal"
                      value={framePrice}
                      onChange={(e) => setFramePrice(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                </div>

                {showMoreFrame && (
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    {!!framesQuery.data?.rows?.length && (
                      <div className="wide">
                        <Field label="Pick from frame inventory">
                          <select
                            value={frameId}
                            onChange={(e) => handleSelectFrame(e.target.value)}
                          >
                            <option value="">Manual entry</option>
                            {framesQuery.data.rows.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.brand} {f.model_no} ({f.colour || "Default"}) · ₹{f.mrp_paise / 100}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    )}
                    <Field label="Colour">
                      <Input
                        value={frameColour}
                        onChange={(e) => setFrameColour(e.target.value)}
                        placeholder="Matte Black, Gold"
                      />
                    </Field>
                    <Field label="Size (eye-bridge-temple)">
                      <Input
                        value={frameSize}
                        onChange={(e) => setFrameSize(e.target.value)}
                        placeholder="52-18-140"
                      />
                    </Field>
                    <Field label="Material">
                      <Input
                        value={frameMaterial}
                        onChange={(e) => setFrameMaterial(e.target.value)}
                        placeholder="Acetate, Titanium"
                      />
                    </Field>
                    <Field label="Frame Type">
                      <select
                        value={frameType}
                        onChange={(e) => setFrameType(e.target.value)}
                      >
                        <option value="">Select</option>
                        <option value="full rim">Full rim</option>
                        <option value="half rim">Half rim</option>
                        <option value="rimless">Rimless</option>
                      </select>
                    </Field>
                    <Field label="Quantity">
                      <Input
                        type="number"
                        min={1}
                        value={frameQty}
                        onChange={(e) => setFrameQty(Number(e.target.value) || 1)}
                      />
                    </Field>
                  </div>
                )}
              </div>
            )}

            {(mode === "Frame + Lens" || mode === "Lens only") && (
              <div style={{ marginBottom: 18 }}>
                <div className="row between" style={{ marginBottom: 10, alignItems: "center" }}>
                  <h3 style={{ fontSize: 15 }}>Lens</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowMoreLens((v) => !v)}
                  >
                    {showMoreLens ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    {showMoreLens ? "Hide extra lens specs" : "+ More lens specs"}
                  </Button>
                </div>

                <div className="form-grid">
                  <Field label="Brand / Name">
                    <Input
                      value={lensBrand}
                      onChange={(e) => setLensBrand(e.target.value)}
                      placeholder="e.g. Essilor, Crizal, Zeiss"
                    />
                  </Field>
                  <Field label="Lens Type">
                    <select
                      value={lensType}
                      onChange={(e) => setLensType(e.target.value)}
                    >
                      <option value="">Any / not specified</option>
                      {LENS_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Coating">
                    <select
                      value={coatings}
                      onChange={(e) => setCoatings(e.target.value)}
                    >
                      <option value="">Any / not specified</option>
                      {COATINGS_LIST.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Lens Price (₹)">
                    <Input
                      inputMode="decimal"
                      value={lensPrice}
                      onChange={(e) => setLensPrice(e.target.value)}
                      placeholder="0"
                    />
                  </Field>
                </div>

                {showMoreLens && (
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    {!!lensesQuery.data?.rows?.length && (
                      <div className="wide">
                        <Field label="Pick from lens inventory">
                          <select
                            value={lensId}
                            onChange={(e) => handleSelectLens(e.target.value)}
                          >
                            <option value="">Manual entry</option>
                            {lensesQuery.data.rows.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.brand} {l.lens_code} ({l.name}) · ₹{l.mrp_paise / 100}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    )}
                    <Field label="Product Name">
                      <Input
                        value={lensName}
                        onChange={(e) => setLensName(e.target.value)}
                        placeholder="e.g. Crizal Prevencia"
                      />
                    </Field>
                    <Field label="Lens Code / SKU">
                      <Input
                        value={lensCode}
                        onChange={(e) => setLensCode(e.target.value)}
                        placeholder="e.g. ES-156"
                      />
                    </Field>
                    <Field label="Refractive Index">
                      <select
                        value={lensIndex}
                        onChange={(e) => setLensIndex(e.target.value)}
                      >
                        <option value="">Select index</option>
                        {LENS_INDICES.map((idx) => (
                          <option key={idx} value={idx}>
                            {idx}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Tint">
                      <select value={tint} onChange={(e) => setTint(e.target.value)}>
                        <option value="">Select tint</option>
                        {TINT_LIST.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Diameter (mm)">
                      <Input
                        value={diaMm}
                        onChange={(e) => setDiaMm(e.target.value)}
                        placeholder="65, 70"
                      />
                    </Field>
                    <Field label="SPH Range">
                      <Input
                        value={sphRange}
                        onChange={(e) => setSphRange(e.target.value)}
                        placeholder="-6.00 to +4.00"
                      />
                    </Field>
                    <Field label="CYL Range">
                      <Input
                        value={cylRange}
                        onChange={(e) => setCylRange(e.target.value)}
                        placeholder="0.00 to -2.00"
                      />
                    </Field>
                    <Field label="Quantity (pairs)">
                      <Input
                        type="number"
                        min={1}
                        value={lensQty}
                        onChange={(e) => setLensQty(Number(e.target.value) || 1)}
                      />
                    </Field>
                  </div>
                )}
              </div>
            )}

            {/* Compact 2-Row Eye Power Table toggle */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowRx((v) => !v)}
              >
                {showRx ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                {showRx ? "Hide eye power (Rx)" : "+ Add eye power / prescription (optional)"}
              </Button>

              {showRx && (
                <div style={{ marginTop: 12 }}>
                  <div className="rx-scroll" style={{ marginBottom: 14 }}>
                    <table className="data-table" style={{ minWidth: 460 }}>
                      <thead>
                        <tr>
                          <th>Eye</th>
                          <th>SPH</th>
                          <th>CYL</th>
                          <th>AXIS</th>
                          <th>ADD</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td><strong>Right (OD)</strong></td>
                          <td><Input value={odSph} onChange={(e) => setOdSph(e.target.value)} placeholder="-1.25" /></td>
                          <td><Input value={odCyl} onChange={(e) => setOdCyl(e.target.value)} placeholder="-0.50" /></td>
                          <td><Input value={odAxis} onChange={(e) => setOdAxis(e.target.value)} placeholder="90" /></td>
                          <td><Input value={odAdd} onChange={(e) => setOdAdd(e.target.value)} placeholder="1.50" /></td>
                        </tr>
                        <tr>
                          <td><strong>Left (OS)</strong></td>
                          <td><Input value={osSph} onChange={(e) => setOsSph(e.target.value)} placeholder="-1.00" /></td>
                          <td><Input value={osCyl} onChange={(e) => setOsCyl(e.target.value)} placeholder="-0.25" /></td>
                          <td><Input value={osAxis} onChange={(e) => setOsAxis(e.target.value)} placeholder="180" /></td>
                          <td><Input value={osAdd} onChange={(e) => setOsAdd(e.target.value)} placeholder="1.50" /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="form-grid">
                    <Field label="PD (mm)">
                      <Input value={binPd} onChange={(e) => setBinPd(e.target.value)} placeholder="62" />
                    </Field>
                    <Field label="Examiner">
                      <Input value={rxExaminer} onChange={(e) => setRxExaminer(e.target.value)} placeholder="Optometrist / Doctor" />
                    </Field>
                    <Field label="Source">
                      <select
                        value={rxSourceType}
                        onChange={(e) => setRxSourceType(e.target.value as "in_shop" | "external")}
                      >
                        <option value="in_shop">In shop</option>
                        <option value="external">External</option>
                      </select>
                    </Field>
                    <Field label="Source Name">
                      <Input
                        value={rxSourceName}
                        onChange={(e) => setRxSourceName(e.target.value)}
                        placeholder="Clinic or Doctor name"
                      />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* 3. Advance Payment & Delivery */}
          <Card>
            <h2>3. Advance Payment</h2>
            <p className="section-note">
              Enter advance received now (if any). Remaining balance is collected when customer picks up the order.
            </p>

            <div className="form-grid" style={{ marginTop: 14 }}>
              <Field label="Advance Paid Now (₹)">
                <Input
                  inputMode="decimal"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="0"
                />
                {grandTotal > 0 && (
                  <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                    <Button
                      type="button"
                      variant="ghost"
                      style={{ minHeight: 30, padding: "2px 8px", fontSize: 11 }}
                      onClick={() => setAdvanceAmount("500")}
                    >
                      ₹500
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      style={{ minHeight: 30, padding: "2px 8px", fontSize: 11 }}
                      onClick={() => setAdvanceAmount("1000")}
                    >
                      ₹1000
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      style={{ minHeight: 30, padding: "2px 8px", fontSize: 11 }}
                      onClick={() => setAdvanceAmount(String(Math.round(grandTotal / 200)))}
                    >
                      50%
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      style={{ minHeight: 30, padding: "2px 8px", fontSize: 11 }}
                      onClick={() => setAdvanceAmount(String(grandTotal / 100))}
                    >
                      Full ({formatMoney(grandTotal)})
                    </Button>
                  </div>
                )}
              </Field>

              <Field label="Payment Mode">
                <div className="row wrap" style={{ gap: 6 }}>
                  {PAYMENT_MODES.map(([val, label]) => (
                    <Button
                      key={val}
                      type="button"
                      variant={paymentMode === val ? "primary" : "secondary"}
                      style={{ minHeight: 38, padding: "6px 12px", fontSize: 12 }}
                      onClick={() => setPaymentMode(val)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </Field>

              <Field label="Delivery Date (optional)">
                <Input
                  type="date"
                  value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)}
                />
                <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                  <Button
                    type="button"
                    variant="ghost"
                    style={{ minHeight: 30, padding: "2px 8px", fontSize: 11 }}
                    onClick={() => setPromisedDate(addDaysIso(1))}
                  >
                    Tomorrow
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    style={{ minHeight: 30, padding: "2px 8px", fontSize: 11 }}
                    onClick={() => setPromisedDate(addDaysIso(3))}
                  >
                    +3 days
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    style={{ minHeight: 30, padding: "2px 8px", fontSize: 11 }}
                    onClick={() => setPromisedDate(addDaysIso(7))}
                  >
                    +7 days
                  </Button>
                </div>
              </Field>
            </div>

            <div style={{ marginTop: 14 }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowMoreBooking((v) => !v)}
              >
                {showMoreBooking ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                {showMoreBooking ? "Hide extra booking options" : "+ More options (Lab, Payment ref, City, Tax, Notes)"}
              </Button>

              {showMoreBooking && (
                <div className="form-grid" style={{ marginTop: 12 }}>
                  <Field label="Payment Reference">
                    <Input
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                      placeholder="UPI / Card ref"
                    />
                  </Field>
                  <Field label="Lab / Supplier">
                    <Input
                      value={labName}
                      onChange={(e) => setLabName(e.target.value)}
                      placeholder="In-house Lab"
                    />
                  </Field>
                  <Field label="City">
                    <Input
                      value={custCity}
                      onChange={(e) => setCustCity(e.target.value)}
                      placeholder="City"
                    />
                  </Field>
                  <Field label="Tax Category">
                    <select
                      value={effectiveTaxId}
                      onChange={(e) => setTaxCategoryId(e.target.value)}
                    >
                      {currentTaxes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} · {t.gst_rate_bp / 100}%
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="wide">
                    <Field label="Notes">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Fitting notes or special instructions..."
                      />
                    </Field>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sticky Summary */}
        <Card className="sticky-summary">
          <p className="eyebrow">BOOKING SUMMARY</p>
          <h2>Booking Bill</h2>
          <p className="section-note">
            {custName || "Enter customer details"}
            {custPhone ? ` · ${custPhone}` : ""}
          </p>
          {calcErr ? (
            <p className="error-text">{calcErr}</p>
          ) : (
            previewTotals && (
              <>
                <div className="summary-line summary-total" style={{ marginTop: 14 }}>
                  <span>Order Total</span>
                  <span>{formatMoney(previewTotals.grand_total)}</span>
                </div>
                <div className="summary-line">
                  <span>Advance Paid ({paymentMode.toUpperCase()})</span>
                  <span>{formatMoney(advancePaise)}</span>
                </div>
                <div className="summary-line">
                  <strong>Remaining Balance</strong>
                  <strong>{formatMoney(remainingPaise)}</strong>
                </div>
              </>
            )
          )}
          <div style={{ marginTop: 22 }}>
            <Button
              type="submit"
              disabled={busy || !!calcErr}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Printer size={16} />
              {busy ? "Generating Booking Bill…" : "Save & Generate Booking Bill"}
            </Button>
          </div>
          <small style={{ display: "block", marginTop: 12 }}>
            Next time the customer returns, open Pickups &amp; Orders (or Home) to collect the remaining amount, take a photo, and print the final bill.
          </small>
        </Card>
      </div>
    </form>
  );
}
