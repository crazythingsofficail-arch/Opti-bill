import "server-only";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import fs from "node:fs";
import { formatMoney, amountInWords } from "./money";
import { BRAND_FOOTER } from "./i18n";
import type { PrintData, Prescription } from "./types";
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: path.join(process.cwd(), "public/fonts/roboto-complete-400.ttf"),
      fontWeight: 400,
    },
    {
      src: path.join(process.cwd(), "public/fonts/roboto-complete-700.ttf"),
      fontWeight: 700,
    },
  ],
});
const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 8.5,
    padding: 28,
    paddingBottom: 38,
    color: "#111",
  },
  header: {
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#111",
  },
  name: { fontSize: 20, fontWeight: 700, marginBottom: 6 },
  muted: { color: "#666", fontSize: 8, lineHeight: 1.5 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 14 },
  section: { marginBottom: 12 },
  title: { fontSize: 12, fontWeight: 700, marginBottom: 9 },
  tableHead: {
    flexDirection: "row",
    paddingVertical: 7,
    backgroundColor: "#f3f3f3",
    fontWeight: 700,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 5,
  },
  cell: { paddingHorizontal: 5, fontSize: 8 },
  totals: { width: 235, marginLeft: "auto", marginTop: 15 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  total: {
    fontSize: 13,
    fontWeight: 700,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    paddingTop: 8,
  },
  footer: {
    position: "absolute",
    bottom: 19,
    left: 20,
    right: 20,
    fontSize: 6.8,
    textAlign: "center",
    color: "#666",
  },
  text: { lineHeight: 1.6 },
  photo: {
    width: 280,
    maxHeight: 200,
    objectFit: "contain",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 4,
    backgroundColor: "#fafafa",
  },
  qr: { width: 80, height: 80 },
  label: { fontSize: 8, fontWeight: 700, marginBottom: 5 },
  notice: { padding: 9, backgroundColor: "#f5f5f5", marginBottom: 12 },
  signature: {
    marginTop: 20,
    borderTopWidth: 0.5,
    borderTopColor: "#aaa",
    paddingTop: 6,
    textAlign: "right",
    width: 150,
    marginLeft: "auto",
  },
});
const dt = (v: string | null) =>
  v
    ? new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(v.length === 10 ? v + "T00:00:00+05:30" : v))
    : "—";
const rxValue = (n: number | null | undefined, sign = false) =>
  n == null
    ? "—"
    : `${sign && Number(n) > 0 ? "+" : ""}${Number(n).toFixed(2)}`;
function Rx({ rx, compact = false }: { rx: Prescription; compact?: boolean }) {
  return (
    <View style={s.section}>
      <Text style={s.title}>Prescription · {dt(rx.test_date)}</Text>
      <Text style={s.muted}>
        {rx.examiner_name} · {rx.source.replace("_", " ")}
      </Text>
      <View style={s.tableHead}>
        {["Eye", "SPH", "CYL", "Axis", "ADD", "PD"].map((v) => (
          <Text key={v} style={[s.cell, { width: "16.66%" }]}>
            {v}
          </Text>
        ))}
      </View>
      {(["od", "os"] as const).map((eye) => (
        <View key={eye} style={s.tableRow}>
          {[
            eye.toUpperCase(),
            rxValue(rx[`${eye}_sph`], true),
            rxValue(rx[`${eye}_cyl`], true),
            rx[`${eye}_axis`] == null ? "—" : String(rx[`${eye}_axis`]),
            rxValue(rx[`${eye}_add_power`]),
            rxValue(rx[`${eye}_pd_distance`]),
          ].map((v, i) => (
            <Text key={i} style={[s.cell, { width: "16.66%" }]}>
              {v}
            </Text>
          ))}
        </View>
      ))}
      {!compact && (
        <>
          {(["od", "os"] as const)
            .filter((eye) =>
              [
                "prism",
                "base",
                "pd_near",
                "seg_height",
                "va_unaided",
                "va_aided",
              ].some(
                (k) =>
                  rx[`${eye}_${k}` as keyof Prescription] != null &&
                  rx[`${eye}_${k}` as keyof Prescription] !== "",
              ),
            )
            .map((eye) => (
              <Text key={eye} style={[s.muted, { marginTop: 6 }]}>
                {eye.toUpperCase()} · Prism {rxValue(rx[`${eye}_prism`])}{" "}
                {rx[`${eye}_base`] || ""} · Near PD{" "}
                {rxValue(rx[`${eye}_pd_near`])} · Segment{" "}
                {rxValue(rx[`${eye}_seg_height`])} · VA{" "}
                {rx[`${eye}_va_unaided`] || "—"} /{" "}
                {rx[`${eye}_va_aided`] || "—"}
              </Text>
            ))}
          <Text style={[s.muted, { marginTop: 6 }]}>
            Binocular PD {rxValue(rx.bin_pd)} · Vertex{" "}
            {rxValue(rx.vertex_distance)} · Pantoscopic tilt{" "}
            {rxValue(rx.pantoscopic_tilt)}
          </Text>
          {rx.valid_until && (
            <Text style={s.muted}>Valid until {dt(rx.valid_until)}</Text>
          )}
        </>
      )}
      {rx.remarks && (
        <Text style={[s.text, { marginTop: 7 }]}>{rx.remarks}</Text>
      )}
    </View>
  );
}
function resolvePdfImage(src: string | null | undefined): string | null {
  if (!src) return null;
  if (src.startsWith("data:image/")) return src;
  try {
    const cleanPath = src.startsWith("/") ? src.slice(1) : src;
    let absPath = path.join(process.cwd(), "public", cleanPath);
    if (!fs.existsSync(absPath)) {
      if (cleanPath.endsWith(".webp")) {
        const jpgCandidate = path.join(
          process.cwd(),
          "public",
          cleanPath.replace(/\.webp$/, ".jpg"),
        );
        if (fs.existsSync(jpgCandidate)) absPath = jpgCandidate;
      }
    }
    if (fs.existsSync(absPath)) {
      const ext = path.extname(absPath).toLowerCase();
      const buf = fs.readFileSync(absPath);
      if (ext === ".png") {
        return `data:image/png;base64,${buf.toString("base64")}`;
      }
      if (ext === ".jpg" || ext === ".jpeg") {
        return `data:image/jpeg;base64,${buf.toString("base64")}`;
      }
    }
  } catch (e) {
    console.error("Failed to resolve PDF image:", e);
  }
  return null;
}

export type PrintLayout = "a4" | "thermal" | "job" | "prescription";
export async function renderInvoicePdf(
  data: PrintData,
  layout: PrintLayout = "a4",
  copy = "Original for Recipient",
) {
  const {
    invoice: i,
    items,
    order,
    prescription,
    photo,
    upiQr,
    originalNumber,
    logo,
    signature,
  } = data;
  const pdfPhoto = resolvePdfImage(photo);
  const pdfLogo = resolvePdfImage(logo);
  const pdfSignature = resolvePdfImage(signature);
  const shop = i.shop_snapshot!;
  const c = i.customer_snapshot!;
  const thermal = layout === "thermal",
    job = layout === "job",
    rxOnly = layout === "prescription";
  const money = !job && !rxOnly;
  const width = thermal ? 226.77 : undefined;
  return renderToBuffer(
    <Document title={i.invoice_no || "Opti-X"} author={shop.name}>
      <Page
        size={
          thermal
            ? {
              width: width!,
              height: Math.max(
                650,
                550 +
                items.reduce(
                  (n, l) =>
                    n + 55 + Math.ceil(l.description.length / 25) * 12,
                  0,
                ) +
                (prescription ? 170 : 0) +
                [
                  shop.terms_text,
                  shop.warranty_text,
                  shop.return_policy_text,
                  shop.bank_details,
                ].reduce(
                  (n, t) => n + Math.ceil((t || "").length / 35) * 12,
                  0,
                ),
              ),
            }
            : job
              ? "A5"
              : "A4"
        }
        style={[
          s.page,
          thermal ? { padding: 12, paddingBottom: 40, fontSize: 8 } : {},
        ]}
      >
        <View style={s.header}>
          {!thermal && pdfLogo && (
            <Image
              src={pdfLogo}
              style={{
                width: 60,
                height: 40,
                objectFit: "contain",
                marginBottom: 10,
              }}
            />
          )}
          <Text style={[s.name, thermal ? { fontSize: 16 } : {}]}>
            {shop.name}
          </Text>
          <Text style={s.muted}>
            {shop.legal_name} · {shop.address}, {shop.city}, {shop.state}{" "}
            {shop.pincode}
          </Text>
          <Text style={s.muted}>
            {shop.phone} · {shop.email}
          </Text>
          {shop.gstin && <Text style={s.muted}>GSTIN: {shop.gstin}</Text>}
        </View>
        <View style={s.section}>
          <Text style={s.title}>
            {job
              ? "Lab job card"
              : rxOnly
                ? "Prescription"
                : i.type.replaceAll("_", " ").toUpperCase()}
          </Text>
          <View style={s.row}>
            <Text>{job ? order.order_no : i.invoice_no}</Text>
            <Text>{dt(i.finalised_at)}</Text>
          </View>
          {money && <Text style={s.muted}>{copy}</Text>}
          {i.display_status === "cancelled" && (
            <Text style={s.notice}>CANCELLED · {i.cancel_reason}</Text>
          )}
          {i.original_invoice_id && (
            <Text style={s.muted}>
              Original invoice: {originalNumber} · {i.credit_reason}
            </Text>
          )}
        </View>
        <View style={s.section}>
          <Text style={s.label}>{c.name}</Text>
          {c.phone && <Text style={s.muted}>Phone: {c.phone}</Text>}
          {c.address && (
            <Text style={s.muted}>
              {c.address}
              {c.city ? `, ${c.city}` : ""}
            </Text>
          )}
          {c.gstin && <Text style={s.muted}>GSTIN: {c.gstin}</Text>}
          {money && (
            <Text style={s.muted}>
              Place of supply: {i.place_of_supply_state_code}
            </Text>
          )}
          {job && (
            <Text style={s.muted}>
              Lab: {order.lab_name || "—"} · Due: {dt(order.promised_date)}
            </Text>
          )}
        </View>
        {!rxOnly && (
          <View style={s.section}>
            {!thermal && (
              <View style={s.tableHead}>
                <Text style={[s.cell, { width: job ? "75%" : "38%" }]}>
                  Description
                </Text>
                <Text style={[s.cell, { width: job ? "25%" : "10%" }]}>
                  Qty
                </Text>
                {money && (
                  <>
                    <Text style={[s.cell, { width: "17%" }]}>Rate</Text>
                    <Text style={[s.cell, { width: "17%" }]}>Taxable</Text>
                    <Text style={[s.cell, { width: "18%" }]}>GST</Text>
                  </>
                )}
              </View>
            )}
            {items.map((l) =>
              thermal ? (
                <View key={l.id} style={s.section} wrap={false}>
                  <Text>{l.description}</Text>
                  <Text style={s.muted}>
                    HSN {l.hsn_code} · {l.qty} {l.unit} ×{" "}
                    {formatMoney(l.unit_price_paise)}
                  </Text>
                  <Text style={s.muted}>
                    Discount {formatMoney(l.discount_paise)} · Taxable{" "}
                    {formatMoney(l.taxable_paise)}
                  </Text>
                  <Text>
                    GST {l.gst_rate_bp / 100}% ·{" "}
                    {formatMoney(l.cgst_paise + l.sgst_paise + l.igst_paise)}
                  </Text>
                </View>
              ) : (
                <View key={l.id} style={s.tableRow} wrap={false}>
                  <View style={{ width: job ? "75%" : "38%" }}>
                    <Text style={s.cell}>{l.description}</Text>
                    {money && (
                      <Text style={[s.cell, s.muted]}>
                        HSN {l.hsn_code} · Discount{" "}
                        {formatMoney(l.discount_paise)}
                      </Text>
                    )}
                    {(l.frame_model_no ||
                      l.lens_brand ||
                      Object.values(l.specs || {}).some(Boolean)) && (
                        <Text style={[s.cell, s.muted]}>
                          {l.frame_model_no} {l.lens_brand}{" "}
                          {Object.values(l.specs || {})
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      )}
                  </View>
                  <Text style={[s.cell, { width: job ? "25%" : "10%" }]}>
                    {l.qty} {l.unit}
                  </Text>
                  {money && (
                    <>
                      <Text style={[s.cell, { width: "17%" }]}>
                        {formatMoney(l.unit_price_paise)}
                      </Text>
                      <Text style={[s.cell, { width: "17%" }]}>
                        {formatMoney(l.taxable_paise)}
                      </Text>
                      <Text style={[s.cell, { width: "18%" }]}>
                        {l.gst_rate_bp / 100}%
                        {i.is_interstate
                          ? `\nIGST ${l.igst_rate_bp / 100}% ${formatMoney(l.igst_paise)}`
                          : `\nC ${l.cgst_rate_bp / 100}% ${formatMoney(l.cgst_paise)}\nS ${l.sgst_rate_bp / 100}% ${formatMoney(l.sgst_paise)}`}
                      </Text>
                    </>
                  )}
                </View>
              ),
            )}
          </View>
        )}
        {money && (
          <>
            <View style={[s.totals, thermal ? { width: "100%" } : {}]}>
              {[
                ["Subtotal", i.subtotal],
                ["Discount", -i.discount_total],
                ["Taxable", i.taxable_total],
                ...(i.type === "tax_invoice" ||
                  (i.type === "credit_note" && shop.gst_scheme === "regular")
                  ? i.is_interstate
                    ? [["IGST", i.igst]]
                    : [
                      ["CGST", i.cgst],
                      ["SGST", i.sgst],
                    ]
                  : []),
                ["Round off", i.round_off],
                ["Grand total", i.grand_total],
                ["Paid", i.amount_paid],
                [
                  i.refund_due ? "Refund due" : "Balance",
                  i.refund_due || i.balance_due,
                ],
              ].map(([label, value]) => (
                <View
                  key={label}
                  style={[s.totalRow, label === "Grand total" ? s.total : {}]}
                >
                  <Text>{label}</Text>
                  <Text>{formatMoney(Number(value))}</Text>
                </View>
              ))}
            </View>
            <Text style={[s.text, { marginVertical: 12, fontSize: 8 }]}>
              {amountInWords(i.grand_total)}
            </Text>
            {shop.gst_scheme === "regular" && shop.reverse_charge_text && (
              <Text style={s.muted}>{shop.reverse_charge_text}</Text>
            )}
            {shop.gst_scheme === "composition" &&
              shop.composition_declaration && (
                <Text style={s.muted}>{shop.composition_declaration}</Text>
              )}
          </>
        )}
        {prescription && <Rx rx={prescription} compact={thermal} />}
        {rxOnly && !prescription && (
          <Text>No prescription is attached to this invoice.</Text>
        )}
        {job && order.notes && <Text style={s.text}>{order.notes}</Text>}
        {!thermal && pdfPhoto && (
          <View style={{ marginTop: 14, marginBottom: 10 }}>
            <Image src={pdfPhoto} style={s.photo} />
            <Text style={[s.muted, { marginTop: 4, fontSize: 8 }]}>
              Lens packet
            </Text>
          </View>
        )}
        {money && (
          <View style={{ marginTop: 14 }}>
            {[
              shop.terms_text,
              shop.warranty_text,
              shop.return_policy_text,
              shop.bank_details,
            ]
              .filter(Boolean)
              .map((text, n) => (
                <Text key={n} style={[s.muted, { marginBottom: 5 }]}>
                  {text}
                </Text>
              ))}
          </View>
        )}
        <View style={s.signature}>
          {!thermal && pdfSignature && (
            <Image
              src={pdfSignature}
              style={{
                width: 100,
                height: 30,
                objectFit: "contain",
                marginBottom: 6,
              }}
            />
          )}
          <Text>Authorised signatory</Text>
        </View>
        <Text
          style={[
            s.footer,
            thermal ? { fontSize: 5.7, left: 8, right: 8 } : {},
          ]}
          fixed
        >
          {BRAND_FOOTER}
        </Text>
      </Page>
    </Document>,
  );
}
export async function renderAccessPdf(data: unknown) {
  const text = JSON.stringify(data, null, 2);
  return renderToBuffer(
    <Document title="Customer data access">
      <Page size="A4" style={s.page}>
        <Text style={s.name}>Customer data access</Text>
        <Text style={[s.text, { fontSize: 8 }]}>{text}</Text>
        <Text fixed style={s.footer}>
          {BRAND_FOOTER}
        </Text>
      </Page>
    </Document>,
  );
}
