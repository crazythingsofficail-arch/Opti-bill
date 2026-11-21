"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, today, displayDate } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import type { Report } from "@/lib/types";
import {
  PageTitle,
  Card,
  Field,
  Input,
  Button,
  Skeleton,
  ErrorState,
  DataTable,
  EmptyState,
} from "./ui";
import { useWorkspace, useToast } from "./providers";
export function Reports() {
  const { profile } = useWorkspace();
  const toast = useToast();
  const [from, setFrom] = useState(today().slice(0, 7) + "-01"),
    [to, setTo] = useState(today());
  const result = useQuery({
    queryKey: ["reports", from, to],
    queryFn: () => api<Report>(`reports?from=${from}&to=${to}`),
    enabled: profile.role === "owner" && !!from && !!to,
  });
  async function download(section: keyof Report) {
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, section }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `opti-x-${section}-${from}-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Export downloaded and audit logged");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed");
    }
  }
  if (profile.role !== "owner")
    return (
      <EmptyState
        title="Owner access required"
        description="Reports and exports are restricted to the owner."
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="A CLEARER PICTURE"
        title="Reports"
        description="Sales, tax and payments, reconciled from issued records."
      />
      <div className="filters">
        <Field label="From">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To">
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <p className="muted">
          Dates use India Standard Time. CSV amounts are integer paise.
        </p>
      </div>
      {result.isPending ? (
        <Skeleton rows={6} />
      ) : result.error ? (
        <ErrorState error={result.error} retry={() => void result.refetch()} />
      ) : (
        result.data && (
          <div className="stack">
            <Card>
              <div className="card-heading">
                <h2>Daily sales</h2>
                <Button
                  variant="secondary"
                  onClick={() => void download("daily")}
                >
                  Export CSV
                </Button>
              </div>
              {!!result.data.daily.length && (
                <div
                  className="chart-bars"
                  role="img"
                  aria-label="Daily net sales, including credit notes"
                >
                  {result.data.daily.map((d) => (
                    <div
                      className="chart-bar"
                      key={d.day}
                      title={`${d.day}: ${formatMoney(d.sales)}`}
                      style={{
                        height: `${Math.max(3, (Math.abs(d.sales) / Math.max(...result.data!.daily.map((x) => Math.abs(x.sales)), 1)) * 140)}px`,
                        background: d.sales < 0 ? "#8a8a8a" : undefined,
                      }}
                    />
                  ))}
                </div>
              )}
              <DataTable
                rows={result.data.daily}
                rowKey={(r) => r.day}
                columns={[
                  {
                    key: "day",
                    label: "Day",
                    render: (r) => displayDate(r.day),
                    sort: (r) => r.day,
                  },
                  {
                    key: "taxable",
                    label: "Taxable",
                    render: (r) => formatMoney(r.taxable),
                  },
                  {
                    key: "tax",
                    label: "Tax",
                    render: (r) => formatMoney(r.tax),
                  },
                  {
                    key: "sales",
                    label: "Sales",
                    render: (r) => formatMoney(r.sales),
                    sort: (r) => r.sales,
                  },
                ]}
              />
            </Card>
            <Card>
              <div className="card-heading">
                <h2>GST by HSN & rate</h2>
                <Button
                  variant="secondary"
                  onClick={() => void download("gst")}
                >
                  Export CSV
                </Button>
              </div>
              <p className="section-note">
                Working summary for reconciliation. Review B2B/B2C
                classification and statutory filing requirements before
                submitting returns.
              </p>
              <DataTable
                rows={result.data.gst}
                rowKey={(r) => `${r.hsn_code}-${r.gst_rate_bp}`}
                columns={[
                  { key: "hsn", label: "HSN", render: (r) => r.hsn_code },
                  {
                    key: "rate",
                    label: "Rate",
                    render: (r) => `${r.gst_rate_bp / 100}%`,
                  },
                  {
                    key: "taxable",
                    label: "Taxable",
                    render: (r) => formatMoney(r.taxable),
                  },
                  {
                    key: "cgst",
                    label: "CGST",
                    render: (r) => formatMoney(r.cgst),
                  },
                  {
                    key: "sgst",
                    label: "SGST",
                    render: (r) => formatMoney(r.sgst),
                  },
                  {
                    key: "igst",
                    label: "IGST",
                    render: (r) => formatMoney(r.igst),
                  },
                ]}
              />
            </Card>
            <div className="two-column">
              <Card>
                <div className="card-heading">
                  <h2>Payment modes</h2>
                  <Button
                    variant="ghost"
                    onClick={() => void download("modes")}
                  >
                    CSV
                  </Button>
                </div>
                <DataTable
                  rows={result.data.modes}
                  rowKey={(r) => r.mode}
                  columns={[
                    { key: "mode", label: "Mode", render: (r) => r.mode },
                    {
                      key: "amount",
                      label: "Net collections",
                      render: (r) => formatMoney(r.amount),
                    },
                  ]}
                />
              </Card>
              <Card>
                <div className="card-heading">
                  <h2>Dues ageing</h2>
                  <Button
                    variant="ghost"
                    onClick={() => void download("ageing")}
                  >
                    CSV
                  </Button>
                </div>
                <p className="section-note">
                  Current outstanding balances, independent of the selected
                  sales period.
                </p>
                <DataTable
                  rows={result.data.ageing}
                  rowKey={(r) => r.bucket}
                  columns={[
                    { key: "bucket", label: "Age", render: (r) => r.bucket },
                    {
                      key: "amount",
                      label: "Amount",
                      render: (r) => formatMoney(r.amount),
                    },
                  ]}
                />
              </Card>
            </div>
            <div className="two-column">
              <Card>
                <div className="card-heading">
                  <h2>Top frames & lens brands</h2>
                  <Button
                    variant="ghost"
                    onClick={() => void download("products")}
                  >
                    CSV
                  </Button>
                </div>
                <DataTable
                  rows={result.data.products}
                  rowKey={(r) => r.product}
                  columns={[
                    {
                      key: "product",
                      label: "Product",
                      render: (r) => r.product,
                    },
                    {
                      key: "qty",
                      label: "Net quantity",
                      render: (r) => r.quantity,
                    },
                    {
                      key: "sales",
                      label: "Taxable sales",
                      render: (r) => formatMoney(r.sales),
                    },
                  ]}
                />
              </Card>
              <Card>
                <div className="card-heading">
                  <h2>Staff-wise sales</h2>
                  <Button
                    variant="ghost"
                    onClick={() => void download("staff")}
                  >
                    CSV
                  </Button>
                </div>
                <DataTable
                  rows={result.data.staff}
                  rowKey={(r) => r.full_name}
                  columns={[
                    {
                      key: "staff",
                      label: "Staff",
                      render: (r) => r.full_name,
                    },
                    {
                      key: "sales",
                      label: "Net sales",
                      render: (r) => formatMoney(r.sales),
                    },
                  ]}
                />
              </Card>
            </div>
          </div>
        )
      )}
    </>
  );
}
