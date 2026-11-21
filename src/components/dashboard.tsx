"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  ArrowUpRight,
  Users,
  Glasses,
  Package,
  FileText,
  ChartNoAxesCombined,
} from "lucide-react";
import { api, displayDate } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import type { Invoice, Order } from "@/lib/types";
import { useWorkspace } from "./providers";
import {
  PageTitle,
  StatCard,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  Badge,
  DataTable,
} from "./ui";
export type DashboardData = {
  stats: { today: number; month: number; dues: number; ready: number };
  recent: Invoice[];
  due: Order[];
};
export function Dashboard({ initial }: { initial?: DashboardData }) {
  const { profile, shop } = useWorkspace();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<DashboardData>("dashboard"),
    initialData: initial,
  });
  return (
    <>
      <PageTitle
        eyebrow={new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date())}
        title="A little clarity. A better day."
        description={`Welcome back, ${profile.full_name.split(" ")[0]}. Here’s your shop at a glance.`}
        action={
          <Link className="button primary" href="/new-bill">
            <Plus size={17} />
            New bill
          </Link>
        }
      />
      {!shop.privacy_version && (
        <div className="notice warning" style={{ marginBottom: 24 }}>
          Finish your shop policies and tax settings before creating the first
          bill.{" "}
          <Link href="/settings" className="text-link">
            Complete setup
          </Link>
        </div>
      )}
      {isPending ? (
        <Skeleton />
      ) : error ? (
        <ErrorState error={error} retry={() => void refetch()} />
      ) : (
        data && (
          <>
            <div className="stat-grid">
              <StatCard
                label="Today’s sales"
                value={formatMoney(Number(data.stats.today))}
                note="Net of credit notes"
                signature
              />
              <StatCard
                label="This month"
                value={formatMoney(Number(data.stats.month))}
                note="Invoiced this calendar month"
              />
              <StatCard
                label="Pending balance"
                value={formatMoney(Number(data.stats.dues))}
                note="Across all open invoices"
              />
              <StatCard
                label="Ready for delivery"
                value={String(data.stats.ready)}
                note="Orders ready for collection"
              />
            </div>
            <div className="quick-actions">
              <Link href="/customers" className="quick-action">
                <Users size={18} />
                Find / Register customer
                <ArrowUpRight size={16} />
              </Link>
              <Link href="/new-bill" className="quick-action">
                <Glasses size={18} />
                Create bill & prescription
                <ArrowUpRight size={16} />
              </Link>
              <Link href="/inventory" className="quick-action">
                <Package size={18} />
                Manage inventory
                <ArrowUpRight size={16} />
              </Link>
              <Link href="/reports" className="quick-action">
                <ChartNoAxesCombined size={18} />
                Sales & tax reports
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="dashboard-grid">
              <Card>
                <div className="card-heading">
                  <h2>Recent bills</h2>
                </div>
                {data.recent.length ? (
                  <DataTable
                    rows={data.recent}
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
                            <small>{displayDate(i.created_at)}</small>
                          </Link>
                        ),
                      },
                      {
                        key: "customer",
                        label: "Customer",
                        render: (i) =>
                          i.customer_snapshot?.name || "Customer",
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: (i) => <Badge>{i.display_status}</Badge>,
                      },
                      {
                        key: "amount",
                        label: "Amount",
                        render: (i) => formatMoney(i.grand_total),
                      },
                    ]}
                  />
                ) : (
                  <EmptyState
                    title="Your first bill starts here."
                    description="Create an invoice with frame and lens specifications."
                    href="/new-bill"
                    action="Create your first bill"
                  />
                )}
              </Card>
              <Card>
                <div className="card-heading">
                  <h2>Quick actions</h2>
                  <Package size={18} className="muted" />
                </div>
                <div className="small-stack" style={{ marginTop: 12 }}>
                  <Link href="/customers" className="button secondary" style={{ justifyContent: "space-between" }}>
                    <span>Register new customer</span>
                    <ArrowUpRight size={16} />
                  </Link>
                  <Link href="/inventory" className="button secondary" style={{ justifyContent: "space-between" }}>
                    <span>Add frame to inventory</span>
                    <ArrowUpRight size={16} />
                  </Link>
                  <Link href="/new-bill" className="button primary" style={{ justifyContent: "space-between" }}>
                    <span>Start new bill</span>
                    <Plus size={16} />
                  </Link>
                </div>
                <div className="notice" style={{ fontSize: 11, marginTop: 24 }}>
                  Customer registration, frame and lens specifications, billing, and inventory in one fast workspace.
                </div>
              </Card>
            </div>
          </>
        )
      )}
    </>
  );
}
