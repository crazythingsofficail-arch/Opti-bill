"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Printer, Check } from "lucide-react";
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
  SearchInput,
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

export function OrderBooking() {
  const { shop } = useWorkspace();
  const toast = useToast();
  const searchParams = useSearchParams();

  // Customer fields
  const [customerId, setCustomerId] = useState<string | null>(
    searchParams.get("customer") || null,
  );
  const [custSearch, setCustSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custAge, setCustAge] = useState("");
  const [custCity, setCustCity] = useState("");

  // Mode: Frame + Lens | Frame only | Lens only
  const [mode, setMode] = useState("Frame + Lens");

  // Frame parameters (all optional)
  const [frameId, setFrameId] = useState("");
  const [frameBrand, setFrameBrand] = useState("");
  const [frameModel, setFrameModel] = useState("");
  const [frameColour, setFrameColour] = useState("");
  const [frameSize, setFrameSize] = useState("");
  const [frameMaterial, setFrameMaterial] = useState("");
  const [frameType, setFrameType] = useState("");
  const [framePrice, setFramePrice] = useState("0");
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
  const [lensPrice, setLensPrice] = useState("0");
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
  const [advanceAmount, setAdvanceAmount] = useState("0");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "bank" | "other">("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [promisedDate, setPromisedDate] = useState("");
  const [labName, setLabName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(custSearch), 250);
    return () => clearTimeout(t);
  }, [custSearch]);

  const customerQuery = useQuery({
    queryKey: ["booking-cust-search", debouncedSearch],
    queryFn: () =>
      api<{ rows: Customer[] }>(`customers?q=${encodeURIComponent(debouncedSearch)}`),
    enabled: debouncedSearch.trim().length >= 2,
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
    setCustSearch("");
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
      setFramePrice(String(f.mrp_paise / 100));
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
      setLensPrice(String(l.mrp_paise / 100));
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
      toast("Order booked & Booking bill generated");
      window.location.assign(`/print/${res.invoiceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to book order");
      setBusy(false);
    }
  }

  const remainingPaise = Math.max(0, (previewTotals?.grand_total || 0) - advancePaise);

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <PageTitle
        eyebrow="ORDER BOOKING"
        title="Book Frame or Lens Order"
        description="Record customer details, product parameters, and advance payment to generate a Booking Bill."
        action={<Badge>Booking Bill</Badge>}
      />

      {error && (
        <div className="notice error-text" role="alert" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div className="wizard-layout">
        <div className="stack">
          {/* 1. Customer */}
          <Card>
            <div className="card-heading">
              <div>
                <h2>1. Customer Details</h2>
                <p className="section-note">
                  Search existing customer or enter Name, Phone, and Age below.
                </p>
              </div>
              {customerId && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setCustomerId(null);
                    setCustName("");
                    setCustPhone("");
                    setCustAge("");
                    setCustCity("");
                  }}
                >
                  New customer
                </Button>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <SearchInput
                value={custSearch}
                onChange={setCustSearch}
                label="Search existing customer by phone or name (optional)"
              />
              {customerQuery.data?.rows?.length ? (
                <div style={{ marginTop: 10 }}>
                  {customerQuery.data.rows.slice(0, 5).map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      className="list-choice"
                      onClick={() => pickExistingCustomer(c)}
                    >
                      <span>
                        <strong>{c.name}</strong>
                        <small>
                          {c.phone} {c.age_years != null ? `· Age ${c.age_years}` : ""} · First visit {displayDate(c.created_at)}
                        </small>
                      </span>
                      <Check size={16} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="form-grid">
              <Field label="Customer name">
                <Input
                  value={custName}
                  onChange={(e) => {
                    setCustName(e.target.value);
                    if (customerId) setCustomerId(null);
                  }}
                  placeholder="Full name"
                  required
                />
              </Field>
              <Field label="Phone number (+91)">
                <Input
                  type="tel"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="10-digit mobile number"
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
              <Field label="City (optional)">
                <Input
                  value={custCity}
                  onChange={(e) => setCustCity(e.target.value)}
                  placeholder="City"
                />
              </Field>
            </div>
          </Card>

          {/* 2. Frame / Lens / Both */}
          <Card>
            <div className="card-heading">
              <div>
                <h2>2. Frame & Lens Parameters</h2>
                <p className="section-note">
                  Choose Frame, Lens, or Both. All parameter fields are optional — fill only what applies.
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
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, marginBottom: 12 }}>Frame Parameters</h3>
                <div className="form-grid">
                  {!!framesQuery.data?.rows?.length && (
                    <div className="wide">
                      <Field label="Pick from frame inventory (optional)">
                        <select
                          value={frameId}
                          onChange={(e) => handleSelectFrame(e.target.value)}
                        >
                          <option value="">Enter frame specifications manually</option>
                          {framesQuery.data.rows.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.brand} {f.model_no} ({f.colour || "Default"}) · ₹{f.mrp_paise / 100} · Stock {f.stock_qty}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}
                  <Field label="Frame brand (optional)">
                    <Input
                      value={frameBrand}
                      onChange={(e) => setFrameBrand(e.target.value)}
                      placeholder="e.g. Ray-Ban, Titan, Fastrack"
                    />
                  </Field>
                  <Field label="Model / SKU (optional)">
                    <Input
                      value={frameModel}
                      onChange={(e) => setFrameModel(e.target.value)}
                      placeholder="e.g. RB3025"
                    />
                  </Field>
                  <Field label="Colour (optional)">
                    <Input
                      value={frameColour}
                      onChange={(e) => setFrameColour(e.target.value)}
                      placeholder="e.g. Matte Black, Gold"
                    />
                  </Field>
                  <Field label="Size — eye–bridge–temple (optional)">
                    <Input
                      value={frameSize}
                      onChange={(e) => setFrameSize(e.target.value)}
                      placeholder="e.g. 52-18-140"
                    />
                  </Field>
                  <Field label="Material (optional)">
                    <Input
                      value={frameMaterial}
                      onChange={(e) => setFrameMaterial(e.target.value)}
                      placeholder="e.g. Acetate, Titanium, TR90"
                    />
                  </Field>
                  <Field label="Frame type (optional)">
                    <select
                      value={frameType}
                      onChange={(e) => setFrameType(e.target.value)}
                    >
                      <option value="">Select frame type</option>
                      <option value="full rim">Full rim</option>
                      <option value="half rim">Half rim</option>
                      <option value="rimless">Rimless</option>
                    </select>
                  </Field>
                  <Field label="Frame price (₹)">
                    <Input
                      inputMode="decimal"
                      value={framePrice}
                      onChange={(e) => setFramePrice(e.target.value)}
                      placeholder="0.00"
                    />
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
              </div>
            )}

            {(mode === "Frame + Lens" || mode === "Lens only") && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 15, marginBottom: 12 }}>Lens Parameters</h3>
                <div className="form-grid">
                  {!!lensesQuery.data?.rows?.length && (
                    <div className="wide">
                      <Field label="Pick from lens inventory (optional)">
                        <select
                          value={lensId}
                          onChange={(e) => handleSelectLens(e.target.value)}
                        >
                          <option value="">Enter lens specifications manually</option>
                          {lensesQuery.data.rows.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.brand} {l.lens_code} ({l.name}) · ₹{l.mrp_paise / 100} · Stock {l.stock_qty}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}
                  <Field label="Lens brand (optional)">
                    <Input
                      value={lensBrand}
                      onChange={(e) => setLensBrand(e.target.value)}
                      placeholder="e.g. Essilor, Crizal, Zeiss, Hoya"
                    />
                  </Field>
                  <Field label="Product name (optional)">
                    <Input
                      value={lensName}
                      onChange={(e) => setLensName(e.target.value)}
                      placeholder="e.g. Crizal Prevencia"
                    />
                  </Field>
                  <Field label="Lens code / SKU (optional)">
                    <Input
                      value={lensCode}
                      onChange={(e) => setLensCode(e.target.value)}
                      placeholder="e.g. ES-CRIZ-156"
                    />
                  </Field>
                  <Field label="Lens type (optional)">
                    <select
                      value={lensType}
                      onChange={(e) => setLensType(e.target.value)}
                    >
                      <option value="">Select lens type</option>
                      {LENS_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Refractive index / material (optional)">
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
                  <Field label="Coatings (optional)">
                    <select
                      value={coatings}
                      onChange={(e) => setCoatings(e.target.value)}
                    >
                      <option value="">Select coating</option>
                      {COATINGS_LIST.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Tint / treatment (optional)">
                    <select value={tint} onChange={(e) => setTint(e.target.value)}>
                      <option value="">Select tint</option>
                      {TINT_LIST.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Diameter mm (optional)">
                    <Input
                      value={diaMm}
                      onChange={(e) => setDiaMm(e.target.value)}
                      placeholder="e.g. 65, 70"
                    />
                  </Field>
                  <Field label="SPH range (optional)">
                    <Input
                      value={sphRange}
                      onChange={(e) => setSphRange(e.target.value)}
                      placeholder="e.g. -6.00 to +4.00"
                    />
                  </Field>
                  <Field label="CYL range (optional)">
                    <Input
                      value={cylRange}
                      onChange={(e) => setCylRange(e.target.value)}
                      placeholder="e.g. 0.00 to -2.00"
                    />
                  </Field>
                  <Field label="Lens price (₹)">
                    <Input
                      inputMode="decimal"
                      value={lensPrice}
                      onChange={(e) => setLensPrice(e.target.value)}
                      placeholder="0.00"
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
              </div>
            )}

            {/* Optional Eye Power / Rx */}
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Eye power / prescription parameters (optional)
              </summary>
              <div className="form-grid" style={{ marginTop: 14 }}>
                <Field label="OD (Right) SPH">
                  <Input value={odSph} onChange={(e) => setOdSph(e.target.value)} placeholder="-1.25" />
                </Field>
                <Field label="OD CYL">
                  <Input value={odCyl} onChange={(e) => setOdCyl(e.target.value)} placeholder="-0.50" />
                </Field>
                <Field label="OD AXIS">
                  <Input value={odAxis} onChange={(e) => setOdAxis(e.target.value)} placeholder="90" />
                </Field>
                <Field label="OD ADD">
                  <Input value={odAdd} onChange={(e) => setOdAdd(e.target.value)} placeholder="1.50" />
                </Field>
                <Field label="OS (Left) SPH">
                  <Input value={osSph} onChange={(e) => setOsSph(e.target.value)} placeholder="-1.00" />
                </Field>
                <Field label="OS CYL">
                  <Input value={osCyl} onChange={(e) => setOsCyl(e.target.value)} placeholder="-0.25" />
                </Field>
                <Field label="OS AXIS">
                  <Input value={osAxis} onChange={(e) => setOsAxis(e.target.value)} placeholder="180" />
                </Field>
                <Field label="OS ADD">
                  <Input value={osAdd} onChange={(e) => setOsAdd(e.target.value)} placeholder="1.50" />
                </Field>
                <Field label="Binocular PD (mm)">
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
                <Field label="Source name (Clinic / Doctor)">
                  <Input
                    value={rxSourceName}
                    onChange={(e) => setRxSourceName(e.target.value)}
                    placeholder="Clinic or Doctor name"
                  />
                </Field>
              </div>
            </details>
          </Card>

          {/* 3. Advance Payment & Delivery */}
          <Card>
            <h2>3. Advance Payment & Delivery</h2>
            <p className="section-note">
              Collect the booking advance now. Remaining balance will be collected when the customer returns to pick up the product.
            </p>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <Field label="Advance payment paid now (₹)">
                <Input
                  inputMode="decimal"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Mode of payment">
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank transfer</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Payment reference (optional)">
                <Input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="UPI / Txn ref"
                />
              </Field>
              <Field label="Promised delivery date (optional)">
                <Input
                  type="date"
                  value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)}
                />
              </Field>
              <Field label="Lab / supplier name (optional)">
                <Input
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  placeholder="e.g. In-house Lab, Essilor Lab"
                />
              </Field>
              <Field label="Tax category">
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
                <Field label="Notes (optional)">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Fitting notes, special instructions..."
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        {/* Sticky Booking Summary */}
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
                <div className="summary-line">
                  <span>Subtotal</span>
                  <span>{formatMoney(previewTotals.subtotal)}</span>
                </div>
                {shop.gst_scheme === "regular" && (
                  <div className="summary-line">
                    <span>Tax (CGST + SGST)</span>
                    <span>
                      {formatMoney(previewTotals.cgst + previewTotals.sgst)}
                    </span>
                  </div>
                )}
                <div className="summary-line summary-total">
                  <span>Total</span>
                  <span>{formatMoney(previewTotals.grand_total)}</span>
                </div>
                <div className="summary-line">
                  <span>Advance paid ({paymentMode.toUpperCase()})</span>
                  <span>{formatMoney(advancePaise)}</span>
                </div>
                <div className="summary-line">
                  <strong>Remaining balance</strong>
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
            When the product arrives and the customer returns, open this customer or order to collect the remaining balance, take a photo, and print the final bill.
          </small>
        </Card>
      </div>
    </form>
  );
}
