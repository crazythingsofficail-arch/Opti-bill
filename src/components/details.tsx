"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowUpRight, Printer, Download } from "lucide-react";
import { api, displayDate } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import type {
  Customer,
  Prescription,
  Invoice,
  InvoiceItem,
  Payment,
  Order,
  OrderItem,
} from "@/lib/types";
import {
  PageTitle,
  Button,
  Card,
  Skeleton,
  ErrorState,
  EmptyState,
  DataTable,
  Badge,
  BottomSheet,
  Field,
  Input,
  ConfirmDialog,
} from "./ui";
import { CustomerForm, PrescriptionForm, Editor } from "./forms";
import { ImageUploader } from "./image-uploader";
import { useWorkspace, useToast } from "./providers";
import { orderStatuses } from "./records";
export function RxTable({ rx }: { rx: Prescription }) {
  return (
    <div className="rx-scroll">
      <table className="data-table" style={{ minWidth: 370 }}>
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
          {(["od", "os"] as const).map((e) => (
            <tr key={e}>
              <td data-label="Eye">
                {e === "od" ? "OD · Right" : "OS · Left"}
              </td>
              {(
                ["sph", "cyl", "axis", "add_power", "pd_distance"] as const
              ).map((k) => (
                <td key={k} data-label={k.toUpperCase()}>
                  {rx[`${e}_${k}`] == null
                    ? "—"
                    : `${["sph", "cyl"].includes(k) && Number(rx[`${e}_${k}`]) > 0 ? "+" : ""}${Number(rx[`${e}_${k}`]).toFixed(k === "axis" ? 0 : 2)}`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Trend({ records }: { records: Prescription[] }) {
  const data = [...records].slice(0, 12).reverse();
  if (data.length < 2)
    return (
      <p className="muted" style={{ fontSize: 12 }}>
        A power trend will appear after two visits.
      </p>
    );
  const all = data
    .flatMap((r) => [r.od_sph, r.os_sph])
    .filter((v): v is number => v !== null);
  const min = Math.min(...all, -1),
    max = Math.max(...all, 1),
    span = max - min || 1;
  return (
    <figure style={{ margin: 0 }}>
      <svg
        className="trend-svg"
        role="img"
        aria-label="SPH power over recent visits, right eye in gold and left eye in grey"
        viewBox="0 0 600 170"
      >
        <line x1="35" y1="140" x2="580" y2="140" stroke="var(--border)" />
        {(["od", "os"] as const).map((eye, j) => (
          <g key={eye}>
            {data.map((r, i) => {
              const v = r[`${eye}_sph`];
              if (v == null) return null;
              const x = 40 + (i * 520) / (data.length - 1),
                y = 20 + ((max - Number(v)) * 110) / span;
              const previous = i ? data[i - 1][`${eye}_sph`] : null;
              return (
                <g key={r.id}>
                  {previous != null && (
                    <line
                      x1={40 + ((i - 1) * 520) / (data.length - 1)}
                      y1={20 + ((max - Number(previous)) * 110) / span}
                      x2={x}
                      y2={y}
                      stroke={j ? "#888" : "#b49300"}
                      strokeWidth="2"
                    />
                  )}
                  <circle cx={x} cy={y} r="4" fill={j ? "#888" : "#b49300"}>
                    <title>
                      {eye.toUpperCase()} {r.test_date}: {v}
                    </title>
                  </circle>
                </g>
              );
            })}
          </g>
        ))}
        <text x="0" y="22" fill="var(--muted)" fontSize="11">
          {max}
        </text>
        <text x="0" y="135" fill="var(--muted)" fontSize="11">
          {min}
        </text>
        <text x="40" y="164" fill="var(--muted)" fontSize="11">
          {displayDate(data[0].test_date)}
        </text>
        <text x="450" y="164" fill="var(--muted)" fontSize="11">
          {displayDate(data.at(-1)!.test_date)}
        </text>
      </svg>
      <figcaption className="muted" style={{ fontSize: 11 }}>
        SPH (dioptres) · Gold: OD · Grey: OS. Recorded measurements, not a
        clinical interpretation.
      </figcaption>
    </figure>
  );
}
export function CustomerDetail({ id }: { id: string }) {
  const { profile } = useWorkspace();
  const [rx, setRx] = useState<Prescription | true | null>(null),
    [edit, setEdit] = useState(false);
  const toast = useToast();
  const result = useQuery({
    queryKey: ["customer", id],
    queryFn: () =>
      api<{
        customer: Customer;
        prescriptions: Prescription[];
        orders: Order[];
        invoices: Invoice[];
      }>(`customer-detail?id=${id}`),
  });
  if (result.isPending) return <Skeleton />;
  if (result.error)
    return (
      <ErrorState error={result.error} retry={() => void result.refetch()} />
    );
  const d = result.data!;
  async function accessExport(format: "json" | "pdf") {
    try {
      const res = await fetch("/api/customer-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, format }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `customer-access.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed");
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="CUSTOMER RECORD"
        title={d.customer.name}
        description={d.customer.phone || ""}
        action={
          <div className="row wrap">
            {profile.role !== "optometrist" && (
              <Button variant="secondary" onClick={() => setEdit(true)}>
                Edit details
              </Button>
            )}
            <Button onClick={() => setRx(true)}>
              <Plus size={16} />
              Prescription
            </Button>
          </div>
        }
      />
      <div className="two-column">
        <div className="stack">
          <Card>
            <div className="card-heading">
              <h2>Prescription history</h2>
              <Badge>{d.prescriptions.length} records</Badge>
            </div>
            {d.prescriptions.length ? (
              <div className="small-stack">
                {d.prescriptions.map((r) => (
                  <div key={r.id} className="bill-item">
                    <div className="row between">
                      <h3>{displayDate(r.test_date)}</h3>
                      <Button variant="ghost" onClick={() => setRx(r)}>
                        Edit
                      </Button>
                    </div>
                    <small>
                      {r.examiner_name} · {r.source.replace("_", " ")}
                    </small>
                    <RxTable rx={r} />
                    {r.remarks && <p className="muted">{r.remarks}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="A fresh perspective."
                description="Record the first prescription to start this customer’s vision history."
              />
            )}
          </Card>
          <Card>
            <h2 style={{ marginBottom: 20 }}>Power over time</h2>
            <Trend records={d.prescriptions} />
          </Card>
          {profile.role !== "optometrist" && (
            <Card>
              <h2 style={{ marginBottom: 18 }}>Invoices & balances</h2>
              <DataTable
                rows={d.invoices}
                rowKey={(i) => i.id}
                columns={[
                  {
                    key: "number",
                    label: "Invoice",
                    render: (i) => (
                      <Link
                        href={
                          i.status === "draft"
                            ? `/new-bill?draft=${i.id}`
                            : `/print/${i.id}`
                        }
                      >
                        {i.invoice_no || "Draft"}
                      </Link>
                    ),
                  },
                  {
                    key: "total",
                    label: "Total",
                    render: (i) => formatMoney(i.grand_total),
                  },
                  {
                    key: "balance",
                    label: "Balance",
                    render: (i) => formatMoney(i.balance_due),
                  },
                ]}
              />
            </Card>
          )}
        </div>
        <div className="stack">
          <Card>
            <h2>Customer details</h2>
            <dl className="key-value">
              {[
                ["Customer name", d.customer.name],
                ["Phone", d.customer.phone],
                ["Gender", d.customer.gender],
                [
                  "Age / DOB",
                  d.customer.dob
                    ? displayDate(d.customer.dob)
                    : d.customer.age_years,
                ],
                ["Email", d.customer.email],
                ["City", d.customer.city],
                ["Address", d.customer.address],
                ["GSTIN", d.customer.gstin],
                ["Consent version", d.customer.consent_version],
                ["Consent recorded", displayDate(d.customer.consent_at)],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value || "—"}</dd>
                </div>
              ))}
            </dl>
            {profile.role !== "optometrist" && (
              <Link
                className="button primary"
                style={{ marginTop: 24 }}
                href={`/new-bill?customer=${id}`}
              >
                Create bill
                <ArrowUpRight size={15} />
              </Link>
            )}
          </Card>
          <Card>
            <h2 style={{ marginBottom: 18 }}>Orders</h2>
            {d.orders.length ? (
              d.orders.map((o) => (
                <div
                  className="order-card"
                  key={o.id}
                  style={{ display: "block" }}
                >
                  <strong>{o.order_no}</strong>
                  <small>
                    {o.status} · {displayDate(o.promised_date)}
                  </small>
                </div>
              ))
            ) : (
              <p className="muted">No orders yet.</p>
            )}
          </Card>
          {profile.role === "owner" && (
            <Card>
              <h2>Customer data rights</h2>
              <p className="section-note">
                Verify the requester’s identity before providing records. Create
                and track requests in Settings.
              </p>
              <div className="row wrap">
                <Button
                  variant="secondary"
                  onClick={() => void accessExport("json")}
                >
                  Export JSON
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void accessExport("pdf")}
                >
                  Export PDF
                </Button>
                <Link
                  className="text-link"
                  href="/settings?tab=Data%20requests"
                >
                  Manage requests
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
      <BottomSheet
        open={!!rx}
        onClose={() => setRx(null)}
        title={rx === true ? "New prescription" : "Edit prescription"}
      >
        {rx && (
          <PrescriptionForm
            key={rx === true ? "new" : rx.id}
            initial={rx === true ? undefined : rx}
            customerId={id}
            onSaved={() => {
              setRx(null);
              void result.refetch();
            }}
          />
        )}
      </BottomSheet>
      <BottomSheet
        open={edit}
        onClose={() => setEdit(false)}
        title="Edit customer"
      >
        <CustomerForm
          initial={d.customer}
          onSaved={() => {
            setEdit(false);
            void result.refetch();
          }}
        />
      </BottomSheet>
    </>
  );
}
export function InvoiceDetail({ id }: { id: string }) {
  const { profile } = useWorkspace();
  const toast = useToast();
  const [pay, setPay] = useState(false),
    [action, setAction] = useState<{
      kind: "credit" | "cancel" | "reverse";
      id: string;
    } | null>(null),
    [share, setShare] = useState("");
  const [reason, setReason] = useState(""),
    [restock, setRestock] = useState(false),
    [busy, setBusy] = useState(false);
  const [paymentKey, setPaymentKey] = useState(() => crypto.randomUUID());
  const result = useQuery({
    queryKey: ["invoice", id],
    queryFn: () =>
      api<{
        invoice: Invoice;
        items: InvoiceItem[];
        payments: Payment[];
        customerPhone: string | null;
      }>(`invoice-detail?id=${id}`),
  });
  if (result.isPending) return <Skeleton />;
  if (result.error)
    return (
      <ErrorState error={result.error} retry={() => void result.refetch()} />
    );
  const { invoice: i, items, payments, customerPhone } = result.data!;
  async function correction() {
    if (!action) return;
    try {
      setBusy(true);
      const r = await api<{ id?: string }>(action.kind, {
        id: action.id,
        reason,
        restock,
        key: crypto.randomUUID(),
      });
      setAction(null);
      setReason("");
      setRestock(false);
      toast("Record updated");
      if (action.kind === "credit" && r?.id)
        window.location.assign(`/print/${r.id}`);
      else void result.refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Unable to update");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow={i.type === "tax_invoice" ? "Bill" : i.type.replaceAll("_", " ")}
        title={i.invoice_no || "Draft invoice"}
        description={`${i.customer_snapshot?.name || ""} · ${displayDate(i.finalised_at || i.created_at)}`}
        action={
          <div className="row wrap">
            <Link className="button secondary" href={`/print/${id}`}>
              <Printer size={16} />
              Print preview
            </Link>
            <a className="button primary" href={`/api/pdf?id=${id}&layout=a4`}>
              <Download size={16} />
              PDF
            </a>
          </div>
        }
      />
      <div className="two-column">
        <div className="stack">
          <Card>
            <div className="card-heading">
              <h2>Invoice details</h2>
              <Badge>{i.display_status}</Badge>
            </div>
            {i.cancel_reason && (
              <p className="notice">Cancelled: {i.cancel_reason}</p>
            )}
            {i.credit_reason && (
              <p className="notice">
                Credit reason: {i.credit_reason}
                {i.original_invoice_id && (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      className="text-link"
                      href={`/print/${i.original_invoice_id}`}
                    >
                      Original invoice
                    </Link>
                  </>
                )}
              </p>
            )}
            <DataTable
              rows={items}
              rowKey={(l) => l.id}
              columns={[
                {
                  key: "item",
                  label: "Item",
                  render: (l) => (
                    <>
                      <strong>{l.description}</strong>
                      <small>
                        HSN {l.hsn_code} · {l.qty} {l.unit}
                      </small>
                    </>
                  ),
                },
                {
                  key: "rate",
                  label: "Rate",
                  render: (l) => formatMoney(l.unit_price_paise),
                },
                {
                  key: "discount",
                  label: "Discount",
                  render: (l) => formatMoney(l.discount_paise),
                },
                {
                  key: "gst",
                  label: "GST",
                  render: (l) => `${l.gst_rate_bp / 100}%`,
                },
                {
                  key: "total",
                  label: "Taxable",
                  render: (l) => formatMoney(l.taxable_paise),
                },
              ]}
            />
          </Card>
          <Card>
            <h2 style={{ marginBottom: 20 }}>Payment history</h2>
            <DataTable
              rows={payments}
              rowKey={(p) => p.id}
              columns={[
                {
                  key: "date",
                  label: "Date",
                  render: (p) => displayDate(p.paid_at),
                },
                {
                  key: "mode",
                  label: "Mode",
                  render: (p) => <Badge>{p.mode}</Badge>,
                },
                {
                  key: "amount",
                  label: "Amount",
                  render: (p) => formatMoney(p.amount_paise),
                },
                {
                  key: "reference",
                  label: "Reference",
                  render: (p) => p.reason || p.reference_no || "—",
                },
                ...(profile.role === "owner"
                  ? [
                    {
                      key: "reverse",
                      label: "Correction",
                      render: (p: Payment) =>
                        p.amount_paise > 0 &&
                          !payments.some((r) => r.reverses_id === p.id) ? (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setAction({ kind: "reverse", id: p.id })
                            }
                          >
                            Reverse / refund
                          </Button>
                        ) : null,
                    },
                  ]
                  : []),
              ]}
            />
          </Card>
        </div>
        <div className="stack">
          <Card>
            <h2>Bill summary</h2>
            {[
              ["Subtotal", i.subtotal],
              ["Discount", -i.discount_total],
              ["Taxable value", i.taxable_total],
              ["CGST", i.cgst],
              ["SGST", i.sgst],
              ["IGST", i.igst],
              ["Round off", i.round_off],
            ].map(([k, v]) => (
              <div className="summary-line" key={k}>
                <span>{k}</span>
                <span>{formatMoney(Number(v))}</span>
              </div>
            ))}
            <div className="summary-line summary-total">
              <span>Total</span>
              <span>{formatMoney(i.grand_total)}</span>
            </div>
            <div className="summary-line">
              <span>Paid</span>
              <span>{formatMoney(i.amount_paid)}</span>
            </div>
            <div className="summary-line">
              <strong>{i.refund_due ? "Refund due" : "Balance due"}</strong>
              <strong>{formatMoney(i.refund_due || i.balance_due)}</strong>
            </div>
            {i.balance_due > 0 && (
              <Button
                style={{ width: "100%", marginTop: 15 }}
                onClick={() => {
                  setPaymentKey(crypto.randomUUID());
                  setPay(true);
                }}
              >
                Record payment
              </Button>
            )}
          </Card>
          <Card>
            <h2>Share with customer</h2>
            {customerPhone && i.balance_due > 0 && (
              <a
                className="button secondary"
                style={{ marginTop: 15 }}
                target="_blank"
                rel="noreferrer"
                href={`https://wa.me/${customerPhone.replace("+", "")}?text=${encodeURIComponent(`Payment reminder: ${formatMoney(i.balance_due)} is pending against invoice ${i.invoice_no}. Please contact the shop if you need help. Thank you.`)}`}
              >
                WhatsApp payment reminder
              </a>
            )}
            <p className="section-note">
              Create a private PDF link valid for one hour. Sharing includes the
              prescription and lens photo.
            </p>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const r = await api<{ url: string }>("share", { id });
                  setShare(r.url);
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Unable to share");
                }
              }}
            >
              Create share link
            </Button>
            {share && (
              <div className="small-stack" style={{ marginTop: 15 }}>
                <a
                  className="text-link"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://wa.me/?text=${encodeURIComponent(`Your invoice ${i.invoice_no}: ${share}`)}`}
                >
                  Open WhatsApp with invoice
                </a>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(share)
                      .then(() => toast("Share link copied"))
                  }
                >
                  Copy link
                </Button>
              </div>
            )}
          </Card>
          {profile.role === "owner" &&
            i.type !== "credit_note" &&
            i.display_status === "finalised" && (
              <Card>
                <h2>Corrections</h2>
                <p className="section-note">
                  Issued bills stay unchanged. Full credit notes preserve the
                  original tax breakdown. Record refunds separately.
                </p>
                <div className="small-stack">
                  <Button
                    variant="secondary"
                    onClick={() => setAction({ kind: "credit", id })}
                  >
                    Issue full credit note
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setAction({ kind: "cancel", id })}
                  >
                    Cancel invoice
                  </Button>
                </div>
              </Card>
            )}
        </div>
      </div>
      <BottomSheet
        open={pay}
        onClose={() => setPay(false)}
        title="Record payment"
      >
        <Editor
          fields={[
            {
              name: "amount_paise",
              label: "Amount (₹)",
              type: "money",
              required: true,
            },
            {
              name: "mode",
              label: "Payment mode",
              type: "select",
              options: ["cash", "upi", "card", "bank", "other"],
              required: true,
            },
            { name: "reference_no", label: "Reference" },
          ]}
          initial={{ amount_paise: i.balance_due, mode: "cash" }}
          submit="Record payment"
          onSave={async (data) => {
            await api("payment", {
              ...data,
              invoice_id: id,
              idempotency_key: paymentKey,
            });
            setPay(false);
            toast("Payment recorded");
            void result.refetch();
          }}
        />
      </BottomSheet>
      <ConfirmDialog
        open={!!action}
        title={
          action?.kind === "credit"
            ? "Issue full credit note"
            : action?.kind === "cancel"
              ? "Cancel this invoice"
              : "Reverse or refund payment"
        }
        onClose={() => setAction(null)}
        onConfirm={() => void correction()}
        busy={busy}
      >
        <p className="section-note">
          This creates a permanent audit record. Money is not transferred by
          this application; record only a correction or refund you have actually
          made.
        </p>
        <Field label="Reason">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </Field>
        {action?.kind !== "reverse" && (
          <label className="field-checkbox" style={{ marginTop: 18 }}>
            <input
              type="checkbox"
              checked={restock}
              onChange={(e) => setRestock(e.target.checked)}
            />
            <span>
              Return linked frames to stock (only if physically returned).
            </span>
          </label>
        )}
      </ConfirmDialog>
    </>
  );
}
export function OrderDetail({ id }: { id: string }) {
  const toast = useToast();
  const result = useQuery({
    queryKey: ["order", id],
    queryFn: () =>
      api<{
        order: Order;
        items: OrderItem[];
        invoices: Invoice[];
        prescription: Prescription | null;
      }>(`order-detail?id=${id}`),
  });
  if (result.isPending) return <Skeleton />;
  if (result.error)
    return (
      <ErrorState error={result.error} retry={() => void result.refetch()} />
    );
  const { order: o, items, invoices, prescription } = result.data!;
  return (
    <>
      <PageTitle
        eyebrow="JOB CARD"
        title={o.order_no}
        description={`${o.customers?.name || ""} · Due ${displayDate(o.promised_date)}`}
        action={
          invoices.find((i) => i.status === "finalised") && (
            <Link
              className="button primary"
              href={`/print/${invoices.find((i) => i.status === "finalised")!.id}?layout=job`}
            >
              <Printer size={16} />
              Lab job card
            </Link>
          )
        }
      />
      <div className="two-column">
        <div className="stack">
          <Card>
            <h2 style={{ marginBottom: 18 }}>Frame & lens details</h2>
            {items.map((l, n) => (
              <div className="bill-item" key={l.id || n}>
                <strong>{l.description}</strong>
                <p className="muted">
                  {[
                    l.frame_model_no,
                    l.lens_brand,
                    l.lens_code,
                    l.lens_type,
                    l.lens_index,
                    l.coatings,
                    l.tint,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <small>
                  Quantity {l.qty} {l.unit}
                </small>
              </div>
            ))}
            {prescription && <RxTable rx={prescription} />}
            <div style={{ marginTop: 20 }}>
              <ImageUploader orderId={o.id} />
            </div>
          </Card>
          <Card>
            <h2 style={{ marginBottom: 18 }}>Associated bills</h2>
            {invoices.map((i) => (
              <Link
                key={i.id}
                className="order-card"
                href={
                  i.status === "draft"
                    ? `/new-bill?draft=${i.id}`
                    : `/print/${i.id}`
                }
              >
                {i.invoice_no || "Draft"} · {i.display_status}
              </Link>
            ))}
          </Card>
        </div>
        <Card>
          <h2 style={{ marginBottom: 22 }}>Order progress</h2>
          <Editor
            fields={[
              {
                name: "status",
                label: "Status",
                type: "select",
                options: orderStatuses,
                required: true,
              },
              { name: "lab_name", label: "Lab name" },
              {
                name: "promised_date",
                label: "Promised delivery",
                type: "date",
              },
            ]}
            initial={{ ...o }}
            submit="Update order"
            onSave={async (data) => {
              await api("orders", { ...data, id });
              toast("Order updated");
              void result.refetch();
            }}
          />
          {o.notes && (
            <p className="notice" style={{ marginTop: 20 }}>
              {o.notes}
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
