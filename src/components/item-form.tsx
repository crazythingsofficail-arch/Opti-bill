"use client";

import { useState } from "react";
import { parseMoney } from "@/lib/money";
import { itemSchema } from "@/lib/validation";
import type { Frame, Lens, TaxCategory, OrderItem } from "@/lib/types";
import { Button, Field, Input, SegmentedControl } from "./ui";

const MODES = ["Frame + Lens", "Frame only", "Lens only", "Other item"];

const LENS_TYPES = ["single vision", "bifocal", "progressive", "office / computer"];
const LENS_INDICES = [
  "1.50 Standard",
  "1.56 Thin",
  "1.60 Extra Thin",
  "1.67 Ultra Thin",
  "1.74 High Index",
  "Polycarbonate",
];
const COATINGS_LIST = [
  "Anti-Glare (ARC)",
  "Blue Cut / Computer",
  "Scratch Resistant",
  "Hydrophobic",
  "UV400 Protection",
];
const TINT_LIST = [
  "Clear",
  "Photochromic / Transitions",
  "Grey 80%",
  "Brown 80%",
  "Polarized",
];

export function DynamicItemForm({
  frames,
  lenses = [],
  taxes,
  onAdd,
  onClose,
  initialTab,
}: {
  frames: Frame[];
  lenses?: Lens[];
  taxes: TaxCategory[];
  onAdd: (items: OrderItem[]) => void;
  onClose: () => void;
  initialTab?: string;
}) {
  const [activeTab, setActiveTab] = useState(initialTab || "Frame + Lens");
  const [error, setError] = useState("");

  // Common
  const defaultTaxId = taxes[0]?.id || "";
  const [taxCategoryId, setTaxCategoryId] = useState(defaultTaxId);

  // Frame fields
  const [frameId, setFrameId] = useState("");
  const [frameBrand, setFrameBrand] = useState("");
  const [frameModel, setFrameModel] = useState("");
  const [framePrice, setFramePrice] = useState("");
  const [frameQty, setFrameQty] = useState(1);
  const [frameDiscount, setFrameDiscount] = useState("0");

  // Lens fields
  const [lensId, setLensId] = useState("");
  const [lensBrand, setLensBrand] = useState("");
  const [lensCode, setLensCode] = useState("");
  const [lensType, setLensType] = useState("single vision");
  const [lensIndex, setLensIndex] = useState("1.56 Thin");
  const [coatings, setCoatings] = useState("Anti-Glare (ARC)");
  const [tint, setTint] = useState("Clear");
  const [lensPrice, setLensPrice] = useState("");
  const [lensQty, setLensQty] = useState(1);
  const [lensDiscount, setLensDiscount] = useState("0");

  function handleSelectLens(id: string) {
    setLensId(id);
    const l = lenses.find((x) => x.id === id);
    if (l) {
      setLensBrand(l.brand || "");
      setLensCode(l.lens_code || "");
      if (l.lens_type) setLensType(l.lens_type);
      if (l.lens_index) setLensIndex(l.lens_index);
      if (l.coatings) setCoatings(l.coatings);
      if (l.tint) setTint(l.tint);
      setLensPrice(String(l.mrp_paise / 100));
    }
  }

  // Other item fields
  const [otherType, setOtherType] = useState("sunglass");
  const [otherDesc, setOtherDesc] = useState("");
  const [otherQty, setOtherQty] = useState(1);
  const [otherUnit, setOtherUnit] = useState("piece");
  const [otherPrice, setOtherPrice] = useState("");
  const [otherDiscount, setOtherDiscount] = useState("0");

  function handleSelectFrame(id: string) {
    setFrameId(id);
    const f = frames.find((x) => x.id === id);
    if (f) {
      setFrameBrand(f.brand || "");
      setFrameModel(f.model_no || "");
      setFramePrice(String(f.mrp_paise / 100));
    }
  }

  const selectedFrameInv = frames.find((x) => x.id === frameId);
  const selectedLensInv = lenses.find((x) => x.id === lensId);
  const frameStockWarn =
    selectedFrameInv &&
    (activeTab === "Frame only" || activeTab === "Frame + Lens") &&
    selectedFrameInv.stock_qty < (activeTab === "Frame only" ? frameQty : 1);
  const lensStockWarn =
    selectedLensInv &&
    (activeTab === "Lens only" || activeTab === "Frame + Lens") &&
    selectedLensInv.stock_qty < (activeTab === "Lens only" ? lensQty : 1);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setError("");

      if (activeTab === "Frame only") {
        const pricePaise = parseMoney(framePrice || "0");
        const desc = `${frameBrand} ${frameModel}`.trim() || "Spectacle Frame";
        const item = itemSchema.parse({
          item_type: "frame",
          description: desc,
          frame_id: frameId || null,
          frame_model_no: frameModel || "",
          qty: Number(frameQty) || 1,
          unit: "piece",
          unit_price_paise: pricePaise,
          discount_paise: parseMoney(frameDiscount || "0"),
          tax_category_id: taxCategoryId,
        });
        onAdd([item]);
        return;
      }

      if (activeTab === "Lens only") {
        const pricePaise = parseMoney(lensPrice || "0");
        const desc =
          [lensBrand, lensType, lensIndex, coatings]
            .filter(Boolean)
            .join(" · ") || "Prescription Lenses";
        const item = itemSchema.parse({
          item_type: "lens",
          description: desc,
          lens_id: lensId || null,
          lens_brand: lensBrand || "",
          lens_code: lensCode || "",
          lens_type: lensType || "",
          lens_index: lensIndex || "",
          coatings: coatings || "",
          tint: tint || "",
          qty: Number(lensQty) || 1,
          unit: "pair",
          unit_price_paise: pricePaise,
          discount_paise: parseMoney(lensDiscount || "0"),
          tax_category_id: taxCategoryId,
        });
        onAdd([item]);
        return;
      }

      if (activeTab === "Frame + Lens") {
        const fPrice = parseMoney(framePrice || "0");
        const lPrice = parseMoney(lensPrice || "0");
        if (fPrice <= 0 && lPrice <= 0)
          throw new Error("Please enter price for frame and/or lens");

        const items: OrderItem[] = [];
        if (fPrice > 0 || frameModel || frameBrand) {
          const fDesc =
            `Frame: ${frameBrand} ${frameModel}`.trim() || "Spectacle Frame";
          items.push(
            itemSchema.parse({
              item_type: "frame",
              description: fDesc,
              frame_id: frameId || null,
              frame_model_no: frameModel || null,
              qty: 1,
              unit: "piece",
              unit_price_paise: fPrice,
              discount_paise: 0,
              tax_category_id: taxCategoryId,
            }),
          );
        }
        if (lPrice > 0 || lensBrand || lensCode) {
          const lDesc =
            `Lens: ${[lensBrand, lensType, lensIndex, coatings].filter(Boolean).join(" · ")}` ||
            "Prescription Lenses";
          items.push(
            itemSchema.parse({
              item_type: "lens",
              description: lDesc,
              lens_id: lensId || null,
              lens_brand: lensBrand || null,
              lens_code: lensCode || null,
              lens_type: lensType || null,
              lens_index: lensIndex || null,
              coatings: coatings || null,
              tint: tint || null,
              qty: 1,
              unit: "pair",
              unit_price_paise: lPrice,
              discount_paise: 0,
              tax_category_id: taxCategoryId,
            }),
          );
        }
        onAdd(items);
        return;
      }

      if (activeTab === "Other item") {
        const pricePaise = parseMoney(otherPrice || "0");
        if (pricePaise <= 0) throw new Error("Please enter a valid price");
        if (!otherDesc.trim()) throw new Error("Please enter item description");
        const item = itemSchema.parse({
          item_type: otherType,
          description: otherDesc.trim(),
          qty: Number(otherQty) || 1,
          unit: otherUnit,
          unit_price_paise: pricePaise,
          discount_paise: parseMoney(otherDiscount || "0"),
          tax_category_id: taxCategoryId,
        });
        onAdd([item]);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add item");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 20 }}>
        <SegmentedControl
          values={MODES}
          value={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            setError("");
          }}
        />
      </div>

      {error && (
        <p className="notice error-text" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      {(frameStockWarn || lensStockWarn) && (
        <p className="notice warning" style={{ marginBottom: 16 }}>
          {frameStockWarn
            ? `Low frame stock: ${selectedFrameInv!.model_no} has ${selectedFrameInv!.stock_qty} in stock.`
            : ""}{" "}
          {lensStockWarn
            ? `Low lens stock: ${selectedLensInv!.lens_code} has ${selectedLensInv!.stock_qty} pairs in stock (lab order).`
            : ""}
        </p>
      )}

      {/* MODE 1: FRAME ONLY */}
      {activeTab === "Frame only" && (
        <div className="form-grid">
          <div className="wide">
            <Field label="Select frame from inventory (optional)">
              <select
                value={frameId}
                onChange={(e) => handleSelectFrame(e.target.value)}
              >
                <option value="">Enter frame details manually</option>
                {frames.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.brand ? `${f.brand} - ` : ""}
                    {f.model_no} · ₹{f.mrp_paise / 100} ({f.stock_qty} in stock)
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Frame brand">
            <Input
              value={frameBrand}
              onChange={(e) => setFrameBrand(e.target.value)}
              placeholder="e.g. Ray-Ban, Fastrack, Oakley"
            />
          </Field>
          <Field label="Model / SKU (optional)">
            <Input
              value={frameModel}
              onChange={(e) => setFrameModel(e.target.value)}
              placeholder="e.g. RB3025, OX-102"
            />
          </Field>
          <Field label="Quantity">
            <Input
              type="number"
              min={1}
              value={frameQty}
              onChange={(e) => setFrameQty(Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Unit price before tax (₹)">
            <Input
              inputMode="decimal"
              value={framePrice}
              onChange={(e) => setFramePrice(e.target.value)}
              placeholder="0.00"
              required
            />
          </Field>
          <Field label="Line discount (₹)">
            <Input
              inputMode="decimal"
              value={frameDiscount}
              onChange={(e) => setFrameDiscount(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Tax category">
            <select
              value={taxCategoryId}
              onChange={(e) => setTaxCategoryId(e.target.value)}
              required
            >
              {taxes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.gst_rate_bp / 100}% · HSN {t.hsn_code}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {/* MODE 2: LENS ONLY */}
      {activeTab === "Lens only" && (
        <div className="form-grid">
          {lenses && lenses.length > 0 && (
            <div className="wide">
              <Field label="Select lens from inventory (optional)">
                <select
                  value={lensId}
                  onChange={(e) => handleSelectLens(e.target.value)}
                >
                  <option value="">Enter lens details manually</option>
                  {lenses.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.brand ? `${l.brand} - ` : ""}
                      {l.lens_code} ({l.name}) · ₹{l.mrp_paise / 100} ({l.stock_qty} in stock)
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
              placeholder="e.g. Crizal, Essilor, Zeiss, Prime"
            />
          </Field>
          <Field label="Lens type">
            <select
              value={lensType}
              onChange={(e) => setLensType(e.target.value)}
              required
            >
              {LENS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lens index / material">
            <select
              value={lensIndex}
              onChange={(e) => setLensIndex(e.target.value)}
            >
              {LENS_INDICES.map((idx) => (
                <option key={idx} value={idx}>
                  {idx}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Coating(s)">
            <select
              value={coatings}
              onChange={(e) => setCoatings(e.target.value)}
            >
              {COATINGS_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tint">
            <select value={tint} onChange={(e) => setTint(e.target.value)}>
              {TINT_LIST.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lens code / model (optional)">
            <Input
              value={lensCode}
              onChange={(e) => setLensCode(e.target.value)}
              placeholder="e.g. SV-156-BLUE"
            />
          </Field>
          <Field label="Quantity (pairs)">
            <Input
              type="number"
              min={1}
              value={lensQty}
              onChange={(e) => setLensQty(Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Lens price before tax (₹)">
            <Input
              inputMode="decimal"
              value={lensPrice}
              onChange={(e) => setLensPrice(e.target.value)}
              placeholder="0.00"
              required
            />
          </Field>
          <Field label="Line discount (₹)">
            <Input
              inputMode="decimal"
              value={lensDiscount}
              onChange={(e) => setLensDiscount(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Tax category">
            <select
              value={taxCategoryId}
              onChange={(e) => setTaxCategoryId(e.target.value)}
              required
            >
              {taxes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.gst_rate_bp / 100}% · HSN {t.hsn_code}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {/* MODE 3: FRAME + LENS (BOTH) */}
      {activeTab === "Frame + Lens" && (
        <div>
          {/* Frame Section */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, margin: "0 0 12px", color: "var(--fg)" }}>
              1. Frame Details
            </h3>
            <div className="form-grid">
              <div className="wide">
                <Field label="Select frame from inventory (optional)">
                  <select
                    value={frameId}
                    onChange={(e) => handleSelectFrame(e.target.value)}
                  >
                    <option value="">Enter frame details manually</option>
                    {frames.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.brand ? `${f.brand} - ` : ""}
                        {f.model_no} · ₹{f.mrp_paise / 100} ({f.stock_qty} in stock)
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Frame brand">
                <Input
                  value={frameBrand}
                  onChange={(e) => setFrameBrand(e.target.value)}
                  placeholder="e.g. Ray-Ban, Vogue, Fastrack"
                />
              </Field>
              <Field label="Frame model / SKU">
                <Input
                  value={frameModel}
                  onChange={(e) => setFrameModel(e.target.value)}
                  placeholder="e.g. RB3025"
                />
              </Field>
              <Field label="Frame price before tax (₹)">
                <Input
                  inputMode="decimal"
                  value={framePrice}
                  onChange={(e) => setFramePrice(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>
          </div>

          {/* Lens Section */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, margin: "0 0 12px", color: "var(--fg)" }}>
              2. Lens Specifications
            </h3>
            <div className="form-grid">
              {lenses && lenses.length > 0 && (
                <div className="wide">
                  <Field label="Select lens from inventory (optional)">
                    <select
                      value={lensId}
                      onChange={(e) => handleSelectLens(e.target.value)}
                    >
                      <option value="">Enter lens details manually</option>
                      {lenses.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.brand ? `${l.brand} - ` : ""}
                          {l.lens_code} ({l.name}) · ₹{l.mrp_paise / 100} ({l.stock_qty} in stock)
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              )}
              <Field label="Lens brand">
                <Input
                  value={lensBrand}
                  onChange={(e) => setLensBrand(e.target.value)}
                  placeholder="e.g. Crizal, Essilor, Zeiss, Prime"
                />
              </Field>
              <Field label="Lens type">
                <select
                  value={lensType}
                  onChange={(e) => setLensType(e.target.value)}
                >
                  {LENS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lens index / material">
                <select
                  value={lensIndex}
                  onChange={(e) => setLensIndex(e.target.value)}
                >
                  {LENS_INDICES.map((idx) => (
                    <option key={idx} value={idx}>
                      {idx}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Coating(s)">
                <select
                  value={coatings}
                  onChange={(e) => setCoatings(e.target.value)}
                >
                  {COATINGS_LIST.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tint">
                <select value={tint} onChange={(e) => setTint(e.target.value)}>
                  {TINT_LIST.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Lens price before tax (₹)">
                <Input
                  inputMode="decimal"
                  value={lensPrice}
                  onChange={(e) => setLensPrice(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
            </div>
          </div>

          <Field label="Tax category">
            <select
              value={taxCategoryId}
              onChange={(e) => setTaxCategoryId(e.target.value)}
              required
            >
              {taxes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.gst_rate_bp / 100}% · HSN {t.hsn_code}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {/* MODE 4: OTHER ITEM */}
      {activeTab === "Other item" && (
        <div className="form-grid">
          <Field label="Item category">
            <select
              value={otherType}
              onChange={(e) => setOtherType(e.target.value)}
            >
              <option value="sunglass">Sunglass</option>
              <option value="contact_lens">Contact Lens</option>
              <option value="accessory">Accessory / Cleaning Solution</option>
              <option value="service">Service / Repair</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Description">
            <Input
              value={otherDesc}
              onChange={(e) => setOtherDesc(e.target.value)}
              placeholder="e.g. BioTrue Solution 300ml, Spectacle Case"
              required
            />
          </Field>
          <Field label="Quantity">
            <Input
              type="number"
              min={1}
              value={otherQty}
              onChange={(e) => setOtherQty(Number(e.target.value))}
              required
            />
          </Field>
          <Field label="Unit (piece, pair, box, service)">
            <Input
              value={otherUnit}
              onChange={(e) => setOtherUnit(e.target.value)}
              required
            />
          </Field>
          <Field label="Unit price before tax (₹)">
            <Input
              inputMode="decimal"
              value={otherPrice}
              onChange={(e) => setOtherPrice(e.target.value)}
              placeholder="0.00"
              required
            />
          </Field>
          <Field label="Line discount (₹)">
            <Input
              inputMode="decimal"
              value={otherDiscount}
              onChange={(e) => setOtherDiscount(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Tax category">
            <select
              value={taxCategoryId}
              onChange={(e) => setTaxCategoryId(e.target.value)}
              required
            >
              {taxes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.gst_rate_bp / 100}% · HSN {t.hsn_code}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <div className="form-actions" style={{ marginTop: 24 }}>
        <Button variant="ghost" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">
          {activeTab === "Frame + Lens"
            ? "Add Frame & Lens to bill"
            : activeTab === "Frame only"
              ? "Add Frame to bill"
              : activeTab === "Lens only"
                ? "Add Lenses to bill"
                : "Add to bill"}
        </Button>
      </div>
    </form>
  );
}
