"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { BrandUploader } from "./image-uploader";
import { useWorkspace, useToast } from "./providers";
import { Editor, getShopFields, type FormField } from "./forms";
import {
  PageTitle,
  Card,
  Button,
  SegmentedControl,
  DataTable,
  BottomSheet,
  EmptyState,
  ErrorState,
  Skeleton,
  Badge,
  ConfirmDialog,
} from "./ui";
import { api, displayDate, today } from "@/lib/client";
import type { TaxCategory, Profile, DataRequest, Customer } from "@/lib/types";
const textFields: FormField[] = [
  { name: "terms_text", label: "Invoice terms", type: "textarea", wide: true },
  {
    name: "warranty_text",
    label: "Warranty policy",
    type: "textarea",
    wide: true,
  },
  {
    name: "return_policy_text",
    label: "Return policy",
    type: "textarea",
    wide: true,
  },
  {
    name: "composition_declaration",
    label: "Composition declaration",
    type: "textarea",
    wide: true,
    hint: "Required for composition shops. Have the current wording verified.",
  },
  {
    name: "reverse_charge_text",
    label: "Reverse-charge declaration",
    wide: true,
    hint: "Required for regular shops; enter the appropriate declaration.",
  },
  { name: "upi_id", label: "UPI ID" },
  {
    name: "bank_details",
    label: "Bank details (optional)",
    type: "textarea",
    wide: true,
  },
];
const legalFields: FormField[] = [
  {
    name: "privacy_version",
    label: "Policy version",
    required: true,
    hint: "Use a new version whenever legal or consent text changes.",
  },
  { name: "grievance_name", label: "Grievance officer name", required: true },
  {
    name: "grievance_email",
    label: "Grievance email",
    type: "email",
    required: true,
  },
  {
    name: "retention_months",
    label: "Financial retention floor (months)",
    type: "number",
    min: 72,
    required: true,
    hint: "Measured from the annual-return due date, with legal holds. No automatic financial deletion.",
  },
  {
    name: "clinical_retention_months",
    label: "Clinical retention policy (months)",
    type: "number",
    min: 1,
    required: true,
  },
  {
    name: "privacy_text",
    label: "Privacy policy",
    type: "textarea",
    wide: true,
    required: true,
    hint: "Use docs/PRIVACY-POLICY-TEMPLATE.md, adapt to actual shop practice and publish here.",
  },
  {
    name: "terms_of_use_text",
    label: "Terms of use",
    type: "textarea",
    wide: true,
    required: true,
  },
  {
    name: "consent_text",
    label: "Customer consent wording",
    type: "textarea",
    wide: true,
    required: true,
  },
];
const taxFields: FormField[] = [
  { name: "name", label: "Category name", required: true },
  { name: "hsn_code", label: "HSN / SAC code", required: true },
  {
    name: "gst_rate_bp",
    label: "GST rate in basis points",
    type: "number",
    required: true,
    min: 0,
    max: 10000,
    hint: "100 basis points = 1%. Use an even integer for equal CGST/SGST rates.",
  },
  {
    name: "effective_from",
    label: "Effective from",
    type: "date",
    required: true,
  },
  { name: "is_active", label: "Active category", type: "checkbox" },
];
function TaxSettings() {
  const [adding, setAdding] = useState(false),
    [page, setPage] = useState(1);
  const toast = useToast();
  const result = useQuery({
    queryKey: ["settings-taxes", page],
    queryFn: () =>
      api<{ rows: TaxCategory[]; count: number }>(`taxes?page=${page}`),
  });
  return (
    <Card>
      <div className="card-heading">
        <h2>Effective-dated tax categories</h2>
        <Button onClick={() => setAdding(true)}>
          <Plus size={16} />
          Add category
        </Button>
      </div>
      <p className="notice warning" style={{ marginBottom: 20 }}>
        Tax rates and HSN codes change. Confirm current rates with your
        Chartered Accountant or the GST portal before use.
      </p>
      {result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState error={result.error} retry={() => void result.refetch()} />
      ) : (
        <DataTable
          rows={result.data?.rows || []}
          rowKey={(t) => t.id}
          columns={[
            { key: "name", label: "Category", render: (t) => t.name },
            { key: "hsn", label: "HSN", render: (t) => t.hsn_code },
            {
              key: "rate",
              label: "GST",
              render: (t) => `${t.gst_rate_bp / 100}%`,
            },
            {
              key: "effective",
              label: "From",
              render: (t) => displayDate(t.effective_from),
            },
            {
              key: "active",
              label: "Status",
              render: (t) => (
                <Badge>{t.is_active ? "active" : "inactive"}</Badge>
              ),
            },
          ]}
        />
      )}
      <p className="section-note">
        To change a used rate, add a new row with the same category name and a
        new effective date. Issued invoices retain the original tax snapshot.
      </p>
      {(result.data?.count || 0) > 50 && (
        <div className="actions">
          <Button
            disabled={page === 1}
            variant="ghost"
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            disabled={page * 50 >= (result.data?.count || 0)}
            variant="ghost"
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
      <BottomSheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add tax category"
      >
        <Editor
          fields={taxFields}
          initial={{ effective_from: today(), is_active: true }}
          onSave={async (data) => {
            await api("taxes", { data });
            setAdding(false);
            toast("Tax category saved");
            void result.refetch();
          }}
        />
      </BottomSheet>
    </Card>
  );
}
function Members() {
  const [invite, setInvite] = useState(false),
    [edit, setEdit] = useState<Profile | null>(null);
  const result = useQuery({
    queryKey: ["members"],
    queryFn: () => api<{ rows: Profile[] }>("members"),
  });
  const toast = useToast();
  return (
    <Card>
      <div className="card-heading">
        <h2>People & permissions</h2>
        <Button onClick={() => setInvite(true)}>
          <Plus size={16} />
          Invite member
        </Button>
      </div>
      {result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState error={result.error} retry={() => void result.refetch()} />
      ) : (
        <DataTable
          rows={result.data?.rows || []}
          rowKey={(p) => p.id}
          columns={[
            { key: "name", label: "Name", render: (p) => p.full_name },
            {
              key: "role",
              label: "Role",
              render: (p) => <Badge>{p.role}</Badge>,
            },
            {
              key: "status",
              label: "Access",
              render: (p) => (p.is_active ? "Active" : "Disabled"),
            },
            {
              key: "edit",
              label: "",
              render: (p) => (
                <Button variant="ghost" onClick={() => setEdit(p)}>
                  Manage
                </Button>
              ),
            },
          ]}
        />
      )}
      <BottomSheet
        open={invite}
        onClose={() => setInvite(false)}
        title="Invite a team member"
      >
        <p className="section-note">
          An account setup email will be sent when you submit.
        </p>
        <Editor
          fields={[
            { name: "full_name", label: "Full name", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            {
              name: "role",
              label: "Role",
              type: "select",
              options: ["staff", "optometrist", "owner"],
              required: true,
            },
          ]}
          initial={{ role: "staff" }}
          submit="Send invitation"
          onSave={async (data) => {
            await api("invite", data);
            setInvite(false);
            toast("Invitation sent");
            void result.refetch();
          }}
        />
      </BottomSheet>
      <BottomSheet
        open={!!edit}
        onClose={() => setEdit(null)}
        title="Manage access"
      >
        {edit && (
          <Editor
            key={edit.id}
            fields={[
              {
                name: "role",
                label: "Role",
                type: "select",
                options: ["owner", "staff", "optometrist"],
                required: true,
              },
              {
                name: "is_active",
                label: "Allow sign in to this shop",
                type: "checkbox",
              },
            ]}
            initial={edit}
            onSave={async (data) => {
              await api("members", { ...data, id: edit.id });
              setEdit(null);
              toast("Member updated");
              void result.refetch();
            }}
          />
        )}
      </BottomSheet>
    </Card>
  );
}
function Requests() {
  const [adding, setAdding] = useState(false),
    [erase, setErase] = useState<DataRequest | null>(null),
    [resolve, setResolve] = useState<DataRequest | null>(null),
    [busy, setBusy] = useState(false);
  const toast = useToast();
  const result = useQuery({
    queryKey: ["requests"],
    queryFn: () => api<{ rows: DataRequest[] }>("requests"),
  });
  const customers = useQuery({
    queryKey: ["request-customers"],
    queryFn: () => api<{ rows: Customer[] }>("customers"),
    enabled: adding,
  });
  return (
    <Card>
      <div className="card-heading">
        <h2>Data rights requests</h2>
        <Button onClick={() => setAdding(true)}>
          <Plus size={16} />
          New request
        </Button>
      </div>
      <p className="section-note">
        Verify identity and log the request. Personal records can be erased;
        required invoice identities remain subject to statutory retention and
        legal holds.
      </p>
      {result.isPending ? (
        <Skeleton />
      ) : result.error ? (
        <ErrorState error={result.error} retry={() => void result.refetch()} />
      ) : (
        <DataTable
          rows={result.data?.rows || []}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "type",
              label: "Type",
              render: (r) => (
                <>
                  <strong>{r.type}</strong>
                  <small>{displayDate(r.created_at)}</small>
                </>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (r) => <Badge>{r.status}</Badge>,
            },
            { key: "details", label: "Request", render: (r) => r.details },
            {
              key: "action",
              label: "Action",
              render: (r) =>
                r.status === "open" ? (
                  <div className="row">
                    <a
                      className="text-link"
                      href={`/customers/${r.customer_id}`}
                    >
                      Customer
                    </a>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        r.type === "erasure" ? setErase(r) : setResolve(r)
                      }
                    >
                      {r.type === "erasure" ? "Erase" : "Resolve"}
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      )}
      <BottomSheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Record a data request"
      >
        <Editor
          fields={[
            {
              name: "customer_id",
              label: "Customer",
              type: "select",
              options:
                customers.data?.rows.map((c) => ({
                  value: c.id,
                  label: `${c.name} · ${c.phone}`,
                })) || [],
              required: true,
            },
            {
              name: "type",
              label: "Request type",
              type: "select",
              options: ["access", "correction", "erasure"],
              required: true,
            },
            {
              name: "details",
              label: "Identity verification and request details",
              type: "textarea",
              required: true,
              wide: true,
            },
          ]}
          submit="Record request"
          onSave={async (data) => {
            await api("requests", data);
            setAdding(false);
            void result.refetch();
            toast("Request recorded");
          }}
        />
      </BottomSheet>
      <BottomSheet
        open={!!resolve}
        onClose={() => setResolve(null)}
        title="Resolve request"
      >
        {resolve && (
          <Editor
            fields={[
              {
                name: "status",
                label: "Resolution",
                type: "select",
                options: ["completed", "rejected"],
                required: true,
              },
              {
                name: "details",
                label: "Action taken / reason",
                type: "textarea",
                required: true,
                wide: true,
              },
            ]}
            initial={{ status: "completed" }}
            onSave={async (data) => {
              await api("resolve-request", { ...data, id: resolve.id });
              setResolve(null);
              void result.refetch();
            }}
          />
        )}
      </BottomSheet>
      <ConfirmDialog
        open={!!erase}
        title="Erase customer data"
        onClose={() => setErase(null)}
        busy={busy}
        onConfirm={async () => {
          if (!erase) return;
          try {
            setBusy(true);
            await api("erase", { id: erase.id });
            setErase(null);
            void result.refetch();
            toast(
              "Erasure processed; any file removal is tracked until complete.",
            );
          } catch (e) {
            toast(e instanceof Error ? e.message : "Erasure failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          This permanently removes contact and clinical records after
          outstanding payments and refunds are resolved. Tax invoice identity is
          retained. The storage worker completes any photo deletion.
        </p>
      </ConfirmDialog>
    </Card>
  );
}
function SecuritySettings() {
  const { shop } = useWorkspace();
  const [enrolled, setEnrolled] = useState<{
      id: string;
      totp: { qr_code: string; secret: string };
    } | null>(null),
    [verified, setVerified] = useState(false);
  const toast = useToast();
  return (
    <Card>
      <h2>Owner account security</h2>
      <p className="section-note">
        Enroll an authenticator app, verify its code, then require two-factor
        authentication for owner actions.
      </p>
      <p className="notice">
        Owner MFA requirement:{" "}
        {shop.require_owner_mfa ? "Enabled" : "Not enabled"}
      </p>
      <Button
        style={{ marginTop: 20 }}
        onClick={async () => {
          try {
            setEnrolled(await api("mfa-enroll", {}));
          } catch (e) {
            toast(e instanceof Error ? e.message : "Unable to enroll");
          }
        }}
      >
        Set up authenticator
      </Button>
      {enrolled && (
        <div className="small-stack" style={{ marginTop: 24 }}>
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(enrolled.totp.qr_code)}`}
            width={180}
            height={180}
            alt="Scan with your authenticator app"
          />
          <p className="muted">
            Manual key: <code>{enrolled.totp.secret}</code>
          </p>
          <Editor
            fields={[{ name: "code", label: "6-digit code", required: true }]}
            submit="Verify authenticator"
            onSave={async (data) => {
              await api("mfa-verify", {
                factorId: enrolled.id,
                code: data.code,
              });
              setVerified(true);
              toast("Authenticator verified");
            }}
          />
        </div>
      )}
      {(verified || shop.require_owner_mfa) && (
        <div className="actions">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await api("mfa-require", { required: !shop.require_owner_mfa });
                window.location.reload();
              } catch (e) {
                toast(e instanceof Error ? e.message : "Unable to update");
              }
            }}
          >
            {shop.require_owner_mfa
              ? "Disable requirement"
              : "Require owner MFA"}
          </Button>
        </div>
      )}
      <p className="section-note">
        Keep account recovery with the deployment administrator. This app never
        displays or stores recovery credentials.
      </p>
    </Card>
  );
}
export function Settings() {
  const { shop, profile } = useWorkspace();
  const toast = useToast();
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "Shop & policies");
  if (profile.role !== "owner")
    return (
      <EmptyState
        title="Owner access required"
        description="Only the owner can change shop settings."
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="MAKE IT YOURS"
        title="Settings"
        description="Your shop, your team and the details that make every bill correct."
      />
      <div style={{ marginBottom: 26 }}>
        <SegmentedControl
          values={[
            "Shop & policies",
            "Tax categories",
            "Users & roles",
            "Security",
            "Data requests",
            "Backup",
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {tab === "Shop & policies" && (
        <Card>
          <div className="form-grid" style={{ marginBottom: 30 }}>
            <BrandUploader
              kind="logo"
              configured={!!shop.logo_path}
              imageUrl={shop.logo_path}
            />
            <BrandUploader
              kind="signature"
              configured={!!shop.signature_path}
              imageUrl={shop.signature_path}
            />
          </div>
          <h2 style={{ marginBottom: 20 }}>
            Shop profile, print text & legal policies
          </h2>
          <p className="notice warning" style={{ marginBottom: 22 }}>
            Publish complete shop-specific policies before collecting customer
            details. Editable policy documents are included in the project’s
            docs folder. No legal policy is published automatically.
          </p>
          <Editor
            fields={[
              ...getShopFields(shop.gst_scheme !== "unregistered"),
              {
                name: "hsn_digits",
                label: "Required HSN digits",
                type: "number",
                required: true,
                min: 4,
                max: 6,
              },
              ...textFields,
              ...legalFields,
              {
                name: "einvoice_enabled",
                label: "E-invoicing is required for this shop",
                type: "checkbox",
                hint: "When enabled, finalisation is blocked until an IRP integration is implemented.",
              },
            ]}
            initial={{ ...shop, upi_id: shop.upi_id || "" }}
            submit="Save settings & publish policy version"
            onSave={async (data) => {
              await api("settings", data);
              toast("Settings saved");
              window.location.reload();
            }}
          />
        </Card>
      )}
      {tab === "Tax categories" && <TaxSettings />}
      {tab === "Users & roles" && <Members />}
      {tab === "Security" && <SecuritySettings />}
      {tab === "Data requests" && <Requests />}
      {tab === "Backup" && (
        <Card>
          <h2>Backup & recovery</h2>
          <p className="section-note">
            Use the included scripts/backup.sh with a private, access-controlled
            destination. Configure its daily schedule on your server. Confirm
            recovery by running the documented restore drill.
          </p>
          <div className="small-stack">
            <p>
              Database backup: deployment-managed. Opti-X does not claim a
              backup has run until your scheduled job reports success.
            </p>
            <p>
              Storage photos require a separate private object backup. Postgres
              backups contain object metadata, not image bytes.
            </p>
            <p>
              Point-in-time recovery is a separate Supabase service setting. See
              docs/OPERATIONS.md for setup, retention, restoration and migration
              rollback.
            </p>
            <a className="text-link" href="/reports">
              Open reports for monthly CSV archives
            </a>
          </div>
        </Card>
      )}
    </>
  );
}
