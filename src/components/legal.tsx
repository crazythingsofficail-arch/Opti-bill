"use client";
import Link from "next/link";
import { renderPolicy } from "@/lib/legal-format";
import { useWorkspace } from "./providers";
import { PageTitle, Card, EmptyState } from "./ui";
import { BRAND_FOOTER } from "@/lib/i18n";
import { displayDate } from "@/lib/client";
export function Legal({
  kind,
}: {
  kind: "privacy" | "terms" | "support" | "more";
}) {
  const { shop, profile } = useWorkspace();
  if (kind === "support")
    return (
      <>
        <PageTitle
          eyebrow="MADE WITH CARE"
          title="About Opti-X"
          description="A thoughtful workspace for independent optical shops."
        />
        <Card>
          <h2>Opti-X Billing</h2>
          <p className="section-note">
            Prescriptions, billing, orders and shop records in one place.
          </p>
          <p>{BRAND_FOOTER}</p>
          <div className="actions">
            <a className="button primary" href="mailto:hello@opti-x.in">
              Contact support
            </a>
            <a
              className="button secondary"
              href="https://opti-x.in"
              target="_blank"
              rel="noreferrer"
            >
              opti-x.in
            </a>
          </div>
        </Card>
      </>
    );
  if (kind === "more")
    return (
      <>
        <PageTitle
          title="More"
          description="Your workspace, all in one place."
        />
        <Card>
          <div className="small-stack">
            {[
              ["/invoices", "Invoices"],
              ["/payments", "Payments & dues"],
              ["/inventory", "Inventory"],
              ...(profile.role === "owner"
                ? [
                    ["/reports", "Reports"],
                    ["/settings", "Settings"],
                  ]
                : []),
              ["/privacy", "Privacy policy"],
              ["/terms", "Terms of use"],
              ["/support", "About & support"],
            ].map(([href, label]) => (
              <Link className="list-choice" key={href} href={href}>
                {label} →
              </Link>
            ))}
          </div>
        </Card>
      </>
    );
  const body = kind === "privacy" ? shop.privacy_text : shop.terms_of_use_text;
  return (
    <>
      <PageTitle
        eyebrow={shop.legal_name}
        title={kind === "privacy" ? "Privacy policy" : "Terms of use"}
        description={
          shop.privacy_version
            ? `Version ${shop.privacy_version} · Updated ${displayDate(shop.privacy_updated_at)}`
            : "Not yet published"
        }
      />
      <Card>
        {body ? (
          <article className="legal-copy">{renderPolicy(body, shop)}</article>
        ) : (
          <EmptyState
            title="Policy not published"
            description="The owner must publish the shop’s policy in Settings before collecting customer information."
            href={profile.role === "owner" ? "/settings" : undefined}
            action="Open Settings"
          />
        )}
        {body && (
          <p className="notice" style={{ marginTop: 25 }}>
            Grievance contact: {shop.grievance_name} ·{" "}
            <a href={`mailto:${shop.grievance_email}`}>
              {shop.grievance_email}
            </a>
          </p>
        )}
      </Card>
    </>
  );
}
