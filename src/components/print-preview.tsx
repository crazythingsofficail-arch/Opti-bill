"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Printer,
  Download,
  Users,
  ChartNoAxesCombined,
  Plus,
  CheckCircle2,
} from "lucide-react";
import type { PrintData, Shop } from "@/lib/types";
import type { PrintLayout } from "@/lib/pdf";
import { formatMoney, amountInWords } from "@/lib/money";
import { displayDate } from "@/lib/client";
import { Button, PageTitle } from "./ui";
export function PrintPreview({
  data,
  layout,
}: {
  data: PrintData;
  layout: PrintLayout;
}) {
  const [copy, setCopy] = useState("Original for Recipient");
  const router = useRouter();
  const {
    invoice: i,
    items,
    order,
    prescription: rx,
    photo,
    upiQr,
    originalNumber,
    logo,
    signature,
  } = data;
  const s: Shop = i.shop_snapshot || {
    id: "shop-default",
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
    privacy_updated_at: null,
    terms_of_use_text: "Terms of service for Opti-X Optical.",
    consent_text: "I hereby consent to eye examination and prescription record retention.",
    grievance_name: "Grievance Officer",
    grievance_email: "hello@opti-x.in",
    retention_months: 84,
    clinical_retention_months: 84,
    hsn_digits: 4,
    invoice_recipient_threshold_paise: 5000000,
    upi_id: null,
    bank_details: null,
    einvoice_enabled: false,
    require_owner_mfa: false,
    logo_path: null,
    signature_path: null,
  };
  const c = i.customer_snapshot || {
    id: i.customer_id || "walk-in",
    name: "Walk-in Customer",
    phone: "",
    address: "",
    city: "",
    state_code: s.state_code || "29",
    gstin: null,
  };
  const money = layout === "a4" || layout === "thermal";
  const isBookingBill = Boolean(
    i.type === "tax_invoice" &&
      i.is_booking &&
      (order?.status !== "Delivered" || i.balance_due > 0),
  );
  const billTitle =
    layout === "job"
      ? "Lab job card"
      : layout === "prescription"
        ? "Prescription"
        : isBookingBill
          ? "Booking Bill"
          : i.type === "tax_invoice"
            ? "Bill"
            : i.type.replaceAll("_", " ").toUpperCase();
  return (
    <>
      <div className="no-print">
        <PageTitle
          eyebrow="READY FOR THE COUNTER"
          title="Print preview"
          description="Choose a layout and check the document before printing."
          action={
            <div className="row wrap" style={{ gap: "8px" }}>
              <Button onClick={() => window.print()}>
                <Printer size={16} />
                {isBookingBill ? "Print Booking Bill" : "Print Bill"}
              </Button>
              <a
                className="button secondary"
                href={`/api/pdf?id=${i.id}&layout=${layout}&copy=${encodeURIComponent(copy)}`}
              >
                <Download size={16} />
                PDF
              </a>
              {order?.id && order.id !== "ord-default" && isBookingBill && (
                <Link className="button primary" href={`/orders/${order.id}`}>
                  <CheckCircle2 size={16} />
                  Collect Balance &amp; Deliver
                </Link>
              )}
              <Link className="button secondary" href="/orders/new">
                <Plus size={16} />
                Book New Order
              </Link>
              <Link className="button ghost" href="/orders">
                Pickups &amp; Orders
              </Link>
              <Link className="button ghost" href={`/invoices/${i.id}`}>
                Invoice details
              </Link>
            </div>
          }
        />
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "12px 18px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "rgba(34, 197, 94, 0.15)",
                color: "#16a34a",
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={18} />
            </span>
            <div>
              <strong style={{ fontSize: "14px" }}>
                Bill completed for {c?.name || "Customer"} ({i.invoice_no})
              </strong>
              <div className="muted" style={{ fontSize: "12px" }}>
                Document generated. Choose what you would like to do next:
              </div>
            </div>
          </div>
          <div className="row wrap" style={{ gap: "8px" }}>
            <Link
              href="/customers?filter=completed"
              className="button secondary"
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              <Users size={14} />
              See completed customers
            </Link>
            <Link
              href="/reports"
              className="button secondary"
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              <ChartNoAxesCombined size={14} />
              Open report
            </Link>
            {c?.id && c.id !== "walk-in" && (
              <Link
                href={`/customers/${c.id}`}
                className="button secondary"
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                Customer profile
              </Link>
            )}
            <Link
              href="/new-bill"
              className="button primary"
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              <Plus size={14} />
              New bill
            </Link>
          </div>
        </div>
        <div className="filters">
          <select
            aria-label="Print layout"
            value={layout}
            onChange={(e) =>
              router.push(`/print/${i.id}?layout=${e.target.value}`)
            }
          >
            {[
              ["a4", "A4 invoice"],
              ["job", "A5 lab job card"],
              ["thermal", "80 mm receipt"],
              ["prescription", "Prescription slip"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Copy label"
            value={copy}
            onChange={(e) => setCopy(e.target.value)}
          >
            {["Original for Recipient", "Duplicate", "Triplicate"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <span className="muted">
            Prints cleanly on {layout === "thermal" ? "80 mm thermal" : layout === "job" ? "A5" : "A4"} without browser headers or URLs.
          </span>
        </div>
      </div>
      <style>{`@page{size:${layout === "thermal" ? "80mm auto" : layout === "job" ? "A5 portrait" : "A4 portrait"};margin:0}`}</style>
      <article className={`print-document ${layout}`}>
        <header className="print-header">
          {layout !== "thermal" && logo && (
            <img
              src={logo}
              alt="Shop logo"
              style={{
                maxWidth: 240,
                maxHeight: 80,
                width: "auto",
                height: "auto",
                objectFit: "contain",
                marginBottom: s.gstin ? 10 : 0,
                borderRadius: 6,
              }}
            />
          )}
          {(layout === "thermal" || !logo) && <h1>{s.name}</h1>}
          {s.gstin && <p>GSTIN: {s.gstin}</p>}
        </header>
        <section className="print-section">
          <div className="print-flex">
            <div>
              <h2>{billTitle}</h2>
              <strong>
                {layout === "job" ? order.order_no : i.invoice_no}
              </strong>
              {money && <p>{copy}</p>}
            </div>
            <div>
              <p>{displayDate(i.finalised_at)}</p>
              {layout === "job" && (
                <p>Due: {displayDate(order.promised_date)}</p>
              )}
            </div>
          </div>
          {i.display_status === "cancelled" && (
            <p>
              <strong>CANCELLED</strong> · {i.cancel_reason}
            </p>
          )}
          {i.original_invoice_id && (
            <p>
              Original invoice: {originalNumber} · {i.credit_reason}
            </p>
          )}
        </section>
        <section className="print-section">
          <strong>{c?.name || "Walk-in Customer"}</strong>
          {c?.phone && <p>Phone: {c.phone}</p>}
          {c.address && (
            <p>
              {c.address}
              {c.city ? `, ${c.city}` : ""}
            </p>
          )}
          {c.gstin && <p>GSTIN: {c.gstin}</p>}
          {money && <p>Place of supply: {i.place_of_supply_state_code}</p>}
          {layout === "job" && <p>Lab: {order.lab_name || "—"}</p>}
        </section>
        {layout !== "prescription" && (
          <table className="print-table">
            <thead>
              <tr>
                <th>Description{money ? " / HSN" : ""}</th>
                <th>Qty</th>
                {money && (
                  <>
                    <th>Rate</th>
                    <th>Discount</th>
                    <th>Taxable</th>
                    {s.gst_scheme === "regular" && <th>GST</th>}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.description}
                    {money && <small>HSN {l.hsn_code}</small>}
                    <small>
                      {l.frame_model_no} {l.lens_brand}{" "}
                      {Object.values(l.specs || {})
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </td>
                  <td>
                    {l.qty} {l.unit}
                  </td>
                  {money && (
                    <>
                      <td>{formatMoney(l.unit_price_paise)}</td>
                      <td>{formatMoney(l.discount_paise)}</td>
                      <td>{formatMoney(l.taxable_paise)}</td>
                      {s.gst_scheme === "regular" && (
                        <td>
                          {l.gst_rate_bp / 100}%
                          <small>
                            {i.is_interstate
                              ? `IGST ${l.igst_rate_bp / 100}% ${formatMoney(l.igst_paise)}`
                              : `CGST ${l.cgst_rate_bp / 100}% ${formatMoney(l.cgst_paise)} / SGST ${l.sgst_rate_bp / 100}% ${formatMoney(l.sgst_paise)}`}
                          </small>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {money && (
          <>
            <div className="print-totals">
              {[
                ["Subtotal", i.subtotal],
                ["Discount", -i.discount_total],
                ["Taxable value", i.taxable_total],
                ...(s.gst_scheme === "regular"
                  ? [
                      ["CGST", i.cgst],
                      ["SGST", i.sgst],
                      ["IGST", i.igst],
                    ]
                  : []),
                ["Round off", i.round_off],
                ["Grand total", i.grand_total],
                [isBookingBill ? "Advance paid" : "Paid", i.amount_paid],
                [
                  i.refund_due
                    ? "Refund due"
                    : isBookingBill && i.balance_due > 0
                      ? "Remaining balance"
                      : "Balance",
                  i.refund_due || i.balance_due,
                ],
              ].map(([label, amount]) => (
                <div
                  key={label}
                  className={label === "Grand total" ? "print-grand" : ""}
                >
                  <span>{label}</span>
                  <strong>{formatMoney(Number(amount))}</strong>
                </div>
              ))}
            </div>
            <p className="print-words">{amountInWords(i.grand_total)}</p>
            {s.gst_scheme === "regular" && <p>{s.reverse_charge_text}</p>}
            {s.gst_scheme === "composition" && (
              <p>{s.composition_declaration}</p>
            )}
          </>
        )}
        {rx && (
          <section className="print-section">
            <h3>Prescription · {displayDate(rx.test_date)}</h3>
            <p>
              {rx.examiner_name} · {rx.source.replace("_", " ")}
            </p>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Eye</th>
                  <th>SPH</th>
                  <th>CYL</th>
                  <th>AXIS</th>
                  <th>ADD</th>
                  <th>PD</th>
                </tr>
              </thead>
              <tbody>
                {(["od", "os"] as const).map((eye) => (
                  <tr key={eye}>
                    <th>{eye.toUpperCase()}</th>
                    {(
                      [
                        "sph",
                        "cyl",
                        "axis",
                        "add_power",
                        "pd_distance",
                      ] as const
                    ).map((k) => (
                      <td key={k}>
                        {rx[`${eye}_${k}`] == null
                          ? "—"
                          : `${["sph", "cyl"].includes(k) && Number(rx[`${eye}_${k}`]) > 0 ? "+" : ""}${Number(rx[`${eye}_${k}`]).toFixed(k === "axis" ? 0 : 2)}`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {(["od", "os"] as const).map((eye) => (
              <p key={eye} className="print-small">
                {eye.toUpperCase()} · Prism {rx[`${eye}_prism`] ?? "—"}{" "}
                {rx[`${eye}_base`] || ""} · Near PD{" "}
                {rx[`${eye}_pd_near`] ?? "—"} · Segment{" "}
                {rx[`${eye}_seg_height`] ?? "—"} · VA{" "}
                {rx[`${eye}_va_unaided`] || "—"} /{" "}
                {rx[`${eye}_va_aided`] || "—"}
              </p>
            ))}
            <p className="print-small">
              Binocular PD {rx.bin_pd ?? "—"} · Vertex{" "}
              {rx.vertex_distance ?? "—"} · Pantoscopic tilt{" "}
              {rx.pantoscopic_tilt ?? "—"}
            </p>
            {rx.valid_until && (
              <p className="print-small">
                Valid until {displayDate(rx.valid_until)}
              </p>
            )}
            {rx.remarks && <p>{rx.remarks}</p>}
          </section>
        )}
        {layout === "prescription" && !rx && (
          <p>No prescription is attached to this invoice.</p>
        )}
        {layout === "job" && order.notes && <p>{order.notes}</p>}
        {layout !== "thermal" && photo && (
          <div className="print-images" style={{ marginTop: 20 }}>
            <figure style={{ margin: 0, textAlign: "left" }}>
              <img
                src={photo}
                alt="Lens packet"
                className="print-photo-large"
              />
              <figcaption
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#64748b",
                }}
              >
                Lens packet
              </figcaption>
            </figure>
          </div>
        )}
        {money && (
          <div className="print-policies">
            {[
              s.terms_text,
              s.warranty_text,
              s.return_policy_text,
              s.bank_details,
            ]
              .filter(Boolean)
              .map((text, n) => (
                <p key={n}>{text}</p>
              ))}
          </div>
        )}
        <div className="print-signature">
          {layout !== "thermal" && signature && (
            <img
              src={signature}
              alt="Authorised signature"
              style={{ width: 100, height: 35, objectFit: "contain" }}
            />
          )}
          Authorised signatory
        </div>
      </article>
    </>
  );
}
