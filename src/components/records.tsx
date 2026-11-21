"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, ArrowUpRight } from "lucide-react";
import { api, displayDate } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import type { Customer, Invoice, Frame, Order } from "@/lib/types";
import {
  Button,
  PageTitle,
  Card,
  SearchInput,
  DataTable,
  Pager,
  BottomSheet,
  Badge,
  Skeleton,
  ErrorState,
  EmptyState,
  SegmentedControl,
  Input,
} from "./ui";
import { CustomerForm, Editor, type FormField } from "./forms";
import { useWorkspace, useToast } from "./providers";
type List<T> = { rows: T[]; count: number; page: number };
function useList<T>(resource: string, query: string) {
  return useQuery({
    queryKey: [resource, query],
    queryFn: () => api<List<T>>(`${resource}?${query}`),
  });
}
function useSearch(q: string) {
  const [value, setValue] = useState(q);
  useEffect(() => {
    const timer = setTimeout(() => setValue(q), 250);
    return () => clearTimeout(timer);
  }, [q]);
  return value;
}
export function Customers() {
  const { profile } = useWorkspace();
  const searchParams = useSearchParams();
  const initialFilter =
    searchParams.get("filter") === "completed" ? "completed" : "all";
  const [filter, setFilter] = useState<"all" | "completed">(initialFilter);
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [adding, setAdding] = useState(false),
    [selected, setSelected] = useState<
      | (Customer & {
          invoice_count?: number;
          last_invoice_id?: string | null;
          last_invoice_no?: string | null;
          last_invoice_date?: string | null;
          last_invoice_amount?: number | null;
        })
      | null
    >(null);
  const search = useSearch(q);
  const queryParams = new URLSearchParams({ q: search, page: String(page) });
  if (filter === "completed") queryParams.set("filter", "completed");

  const result = useList<
    Customer & {
      invoice_count?: number;
      last_invoice_id?: string | null;
      last_invoice_no?: string | null;
      last_invoice_date?: string | null;
      last_invoice_amount?: number | null;
    }
  >("customers", queryParams.toString());
  return (
    <>
      <PageTitle
        eyebrow="PEOPLE, IN FOCUS"
        title="Customers"
        description="Every visit. Every prescription. One complete record."
        action={
          <div className="row wrap" style={{ gap: "8px" }}>
            <Link className="button secondary" href="/reports">
              Open report
            </Link>
            {profile.role !== "optometrist" && (
              <Button onClick={() => setAdding(true)}>
                <Plus size={17} />
                Add customer
              </Button>
            )}
          </div>
        }
      />
      <div className="two-column">
        <Card>
          <div
            className="filters"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <SearchInput
              value={q}
              onChange={(v) => {
                setQ(v);
                setPage(1);
              }}
              label="Search name, phone or city"
            />
            <div className="row" style={{ gap: "6px" }}>
              <Button
                variant={filter === "all" ? "primary" : "secondary"}
                onClick={() => {
                  setFilter("all");
                  setPage(1);
                }}
              >
                All
              </Button>
              <Button
                variant={filter === "completed" ? "primary" : "secondary"}
                onClick={() => {
                  setFilter("completed");
                  setPage(1);
                }}
              >
                Completed (Billed)
              </Button>
            </div>
          </div>
          {result.isPending ? (
            <Skeleton />
          ) : result.error ? (
            <ErrorState
              error={result.error}
              retry={() => void result.refetch()}
            />
          ) : (
            result.data && (
              <>
                <DataTable
                  rows={result.data.rows}
                  rowKey={(c) => c.id}
                  empty={
                    filter === "completed"
                      ? "No completed billed customers yet"
                      : "No customers yet"
                  }
                  columns={[
                    {
                      key: "name",
                      label: "Name",
                      render: (c) => (
                        <button
                          className="text-link"
                          style={{
                            background: "none",
                            border: 0,
                            color: "inherit",
                            textAlign: "left",
                            fontWeight: 600,
                          }}
                          onClick={() => setSelected(c)}
                        >
                          {c.name}
                        </button>
                      ),
                      sort: (c) => c.name,
                    },
                    { key: "phone", label: "Mobile", render: (c) => c.phone || "—" },
                    {
                      key: "status",
                      label: "Billing status",
                      render: (c) =>
                        c.last_invoice_no ? (
                          <Link
                            href={`/print/${c.last_invoice_id}`}
                            style={{
                              textDecoration: "none",
                              display: "inline-block",
                              padding: "2px 8px",
                              fontSize: "11px",
                              borderRadius: "4px",
                              background: "rgba(34, 197, 94, 0.12)",
                              color: "#15803d",
                              fontWeight: 600,
                            }}
                          >
                            Billed ({c.last_invoice_no})
                          </Link>
                        ) : (
                          <span className="muted" style={{ fontSize: "11px" }}>
                            Registered
                          </span>
                        ),
                    },
                    {
                      key: "created",
                      label: "Date",
                      render: (c) =>
                        displayDate(c.last_invoice_date || c.created_at),
                      sort: (c) => c.created_at,
                    },
                  ]}
                />
                <Pager count={result.data.count} page={page} onPage={setPage} />
              </>
            )
          )}
        </Card>
        <Card>
          {selected ? (
            <>
              <div className="profile-header">
                <div className="avatar">{selected.name[0]}</div>
                <div>
                  <h2>{selected.name}</h2>
                  <p className="muted">{selected.phone || "No phone"}</p>
                </div>
              </div>
              <dl className="key-value">
                <div>
                  <dt>Age</dt>
                  <dd>{selected.age_years ?? "Date of birth recorded"}</dd>
                </div>
                <div>
                  <dt>Consent</dt>
                  <dd>
                    {selected.consent_given ? "Recorded" : "Not recorded"}
                  </dd>
                </div>
                <div>
                  <dt>City</dt>
                  <dd>{selected.city || "—"}</dd>
                </div>
                <div>
                  <dt>First visit</dt>
                  <dd>{displayDate(selected.created_at)}</dd>
                </div>
              </dl>
              {selected.last_invoice_no && (
                <div
                  style={{
                    marginTop: 18,
                    padding: "12px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      marginBottom: 6,
                    }}
                  >
                    Latest finalised bill
                  </div>
                  <div
                    className="row between"
                    style={{ alignItems: "center" }}
                  >
                    <div>
                      <strong>{selected.last_invoice_no}</strong>
                      {selected.last_invoice_amount != null && (
                        <span className="muted" style={{ marginLeft: 8 }}>
                          {formatMoney(selected.last_invoice_amount)}
                        </span>
                      )}
                    </div>
                    {selected.last_invoice_id && (
                      <Link
                        href={`/print/${selected.last_invoice_id}`}
                        className="button secondary"
                        style={{ fontSize: 12, padding: "4px 8px" }}
                      >
                        View & print bill
                      </Link>
                    )}
                  </div>
                </div>
              )}
              <div className="row wrap" style={{ marginTop: 24, gap: "10px" }}>
                <Link
                  className="button primary"
                  href={`/customers/${selected.id}`}
                >
                  Open profile
                  <ArrowUpRight size={16} />
                </Link>
                {profile.role !== "optometrist" && (
                  <Link
                    className="button secondary"
                    href={`/new-bill?customer=${selected.id}`}
                  >
                    Create bill
                  </Link>
                )}
              </div>
            </>
          ) : (
            <EmptyState
              title="A person, beyond the prescription."
              description="Choose a customer to see their details and complete visit history."
            />
          )}
        </Card>
      </div>
      <BottomSheet
        open={adding}
        onClose={() => setAdding(false)}
        title="New customer"
      >
        <CustomerForm
          onSaved={(id) => {
            window.location.assign(`/customers/${id}`);
          }}
        />
      </BottomSheet>
    </>
  );
}
export function Invoices({ dues = false }: { dues?: boolean }) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [payment, setPayment] = useState(dues ? "unpaid" : ""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const search = useSearch(q);
  const params = new URLSearchParams({ q: search, page: String(page) });
  if (status) params.set("status", status);
  if (dues) params.set("payment", "outstanding");
  else if (payment) params.set("payment", payment);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const result = useList<Invoice>("invoices", params.toString());
  const rows = dues
    ? result.data?.rows.filter(
      (i) =>
        i.status === "finalised" && (i.balance_due > 0 || i.refund_due > 0),
    )
    : result.data?.rows;
  return (
    <>
      <PageTitle
        eyebrow="YOUR BILLING DESK"
        title={dues ? "Payments & dues" : "Invoices"}
        description={
          dues
            ? "See what’s outstanding, record payments and close the loop."
            : "A permanent record of every bill, payment and correction."
        }
        action={
          <Link className="button primary" href="/new-bill">
            <Plus size={17} />
            New bill
          </Link>
        }
      />
      <Card>
        <div className="filters">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            label="Search invoice number"
          />
          {!dues && (
            <>
              <select
                aria-label="Invoice status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {["draft", "finalised", "cancelled", "credited"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Payment status"
                value={payment}
                onChange={(e) => {
                  setPayment(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All payments</option>
                {["unpaid", "partial", "paid", "refund_due", "settled"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </>
          )}
          <Input
            aria-label="From date"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
          <Input
            aria-label="To date"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {result.isPending ? (
          <Skeleton />
        ) : result.error ? (
          <ErrorState
            error={result.error}
            retry={() => void result.refetch()}
          />
        ) : (
          <>
            <DataTable
              rows={rows || []}
              rowKey={(i) => i.id}
              empty={
                dues
                  ? "No outstanding balances on this page"
                  : "No invoices yet"
              }
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
                      <small>{displayDate(i.created_at)}</small>
                    </Link>
                  ),
                  sort: (i) => i.invoice_no || "",
                },
                {
                  key: "customer",
                  label: "Customer",
                  render: (i) => i.customer_snapshot?.name || "Draft",
                },
                {
                  key: "status",
                  label: "Status",
                  render: (i) => (
                    <Badge>{dues ? i.payment_status : i.display_status}</Badge>
                  ),
                },
                {
                  key: "amount",
                  label: "Total",
                  render: (i) => formatMoney(i.grand_total),
                  sort: (i) => i.grand_total,
                },
                {
                  key: "balance",
                  label: "Balance / refund",
                  render: (i) => formatMoney(i.refund_due || i.balance_due),
                  sort: (i) => i.balance_due,
                },
              ]}
            />
            <Pager
              count={result.data?.count || 0}
              page={page}
              onPage={setPage}
            />
          </>
        )}
      </Card>
    </>
  );
}
const frameFields: FormField[] = [
  { name: "model_no", label: "Model / SKU", required: true },
  { name: "brand", label: "Brand" },
  { name: "colour", label: "Colour" },
  { name: "size", label: "Size (eye–bridge–temple)" },
  { name: "material", label: "Material" },
  {
    name: "type",
    label: "Frame type",
    type: "select",
    options: ["full rim", "half rim", "rimless"],
  },
  { name: "gender_target", label: "Category" },
  { name: "cost_paise", label: "Cost (₹)", type: "money", required: true },
  { name: "mrp_paise", label: "MRP (₹)", type: "money", required: true },
  {
    name: "stock_qty",
    label: "Stock quantity",
    type: "number",
    required: true,
    min: 0,
  },
];
export function Inventory() {
  const { profile } = useWorkspace();
  const toast = useToast();
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<Frame | true | null>(null);
  const search = useSearch(q);
  const result = useList<Frame>(
    "frames",
    new URLSearchParams({ q: search, page: String(page) }).toString(),
  );
  return (
    <>
      <PageTitle
        eyebrow="THE COLLECTION"
        title="Frames inventory"
        description="Know what’s in stock. Find the right frame faster."
        action={
          profile.role === "owner" && (
            <Button onClick={() => setEditing(true)}>
              <Plus size={16} />
              Add frame
            </Button>
          )
        }
      />
      <Card>
        <div className="filters">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            label="Search model or brand"
          />
        </div>
        {result.isPending ? (
          <Skeleton />
        ) : result.error ? (
          <ErrorState
            error={result.error}
            retry={() => void result.refetch()}
          />
        ) : (
          <>
            <DataTable
              rows={result.data?.rows || []}
              rowKey={(f) => f.id}
              columns={[
                {
                  key: "model",
                  label: "Model",
                  render: (f) => (
                    <strong>
                      {f.model_no}
                      <small>{f.brand}</small>
                    </strong>
                  ),
                  sort: (f) => f.model_no,
                },
                {
                  key: "detail",
                  label: "Details",
                  render: (f) =>
                    [f.colour, f.size, f.material].filter(Boolean).join(" · "),
                },
                {
                  key: "price",
                  label: "MRP",
                  render: (f) => formatMoney(f.mrp_paise),
                  sort: (f) => f.mrp_paise,
                },
                {
                  key: "stock",
                  label: "In stock",
                  render: (f) => <Badge>{f.stock_qty}</Badge>,
                  sort: (f) => f.stock_qty,
                },
                ...(profile.role === "owner"
                  ? [
                    {
                      key: "edit",
                      label: "",
                      render: (f: Frame) => (
                        <Button variant="ghost" onClick={() => setEditing(f)}>
                          Edit
                        </Button>
                      ),
                    },
                  ]
                  : []),
              ]}
            />
            <Pager
              count={result.data?.count || 0}
              page={page}
              onPage={setPage}
            />
          </>
        )}
      </Card>
      <BottomSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === true ? "Add frame" : "Edit frame"}
      >
        {editing && (
          <Editor
            key={editing === true ? "new" : editing.id}
            fields={frameFields}
            initial={editing === true ? {} : editing}
            onSave={async (data) => {
              await api("frames", {
                id: editing === true ? undefined : editing?.id,
                data,
              });
              setEditing(null);
              toast("Frame saved");
              void result.refetch();
            }}
          />
        )}
      </BottomSheet>
    </>
  );
}
export const orderStatuses = [
  "Ordered",
  "Sent to lab",
  "Received from lab",
  "Ready",
  "Delivered",
];
export function Orders() {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [tab, setTab] = useState("Ordered");
  const search = useSearch(q);
  const result = useList<Order>(
    "orders",
    new URLSearchParams({ q: search, page: String(page) }).toString(),
  );
  return (
    <>
      <PageTitle
        eyebrow="FROM COUNTER TO COLLECTION"
        title="Orders"
        description="A clear path from prescription to a perfect fit."
        action={
          <Link href="/new-bill" className="button primary">
            <Plus size={16} />
            New order
          </Link>
        }
      />
      <div className="filters">
        <SearchInput
          value={q}
          onChange={(v) => {
            setQ(v);
            setPage(1);
          }}
          label="Search order number"
        />
      </div>
      <div className="mobile-only" style={{ marginBottom: 20 }}>
        <SegmentedControl
          values={orderStatuses}
          value={tab}
          onChange={setTab}
        />
      </div>
      {result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState error={result.error} retry={() => void result.refetch()} />
      ) : (
        <>
          <div className="kanban">
            {orderStatuses.map((status) => (
              <section
                key={status}
                className={`kanban-column ${status !== tab ? "desktop-only" : ""}`}
              >
                <div className="kanban-heading">
                  <strong>{status}</strong>
                  <Badge>
                    {result.data?.rows.filter((o) => o.status === status)
                      .length || 0}
                  </Badge>
                </div>
                {result.data?.rows
                  .filter((o) => o.status === status)
                  .map((o) => (
                    <div
                      key={o.id}
                      className="order-card"
                    >
                      <strong>{o.order_no}</strong>
                      <small>Due {displayDate(o.promised_date)}</small>
                      <small>{o.lab_name || "Lab not assigned"}</small>
                    </div>
                  ))}
                {!result.data?.rows.some((o) => o.status === status) && (
                  <p className="muted" style={{ fontSize: 12 }}>
                    No orders at this stage.
                  </p>
                )}
              </section>
            ))}
          </div>
          <Pager count={result.data?.count || 0} page={page} onPage={setPage} />
        </>
      )}
    </>
  );
}
