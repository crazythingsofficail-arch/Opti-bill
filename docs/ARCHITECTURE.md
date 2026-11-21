# Opti-X Billing architecture

The deliverable is a locally runnable Next.js App Router project backed by Supabase Auth, Postgres and private Storage. It has no seeded business data. Financial writes require an authenticated online request. The browser renders an empty setup state until configured.

## Folder structure

```text
src/app/                 Pages, server actions and guarded API routes
src/components/          Shared UI, forms, billing wizard and print components
src/lib/                 Integer money engine, validation, i18n, security and data access
src/supabase/            Cookie-based server and browser clients and schema types
supabase/migrations/     Schema, RLS, ledger functions, storage policies
tests/unit/              Money, GSTIN, prescription and formatting tests
tests/integration/       Real Postgres engine (PGlite) migrations and isolation tests
tests/e2e/               Playwright smoke and connected-stack workflows
docs/                    Phase report, deployment, legal, operations and acceptance
scripts/                 Backup, type regeneration and packaging helpers
public/                  PWA shell, manifest icons and locally bundled print fonts
```

## Trust boundaries

Postgres is the source of truth. Browser totals are a preview only. Finalisation re-reads effective tax categories, computes integer paise using numeric intermediates, locks the draft and series, freezes snapshots, consumes inventory, and appends payments in one transaction. Financial tables have no direct mutation grants. Security-definer RPCs validate authenticated shop and role and use a fixed search path. Composite foreign keys stop cross-shop references. Only owner actions issue credits, cancellations, data exports or configuration changes.

All authenticated traffic uses same-origin route handlers with HttpOnly cookie sessions and CSRF Origin checks. No service key reaches client components. The browser anon client is available for public Supabase integration, but normal app data goes through authenticated server routes. Staff can read records needed for work; an application export restriction cannot stop a person manually copying data they may read.

Invoice document fields are immutable after finalisation. Balances are a separate derived ledger projection; cancellations are append-only events. The `invoice_register` view combines them, avoiding exceptions that could accidentally unlock frozen invoice rows. A full credit copies the original taxed lines with negative reporting polarity; no tax rate is looked up again. Refunds are separate reversing payment rows and are owner-only. Partial credit notes are an explicitly documented future extension.

## Screens

Login, forgot/reset password, owner onboarding, dashboard, customer search/profile, prescription editor/history/trend, four-step new bill and saved drafts, order board/detail, invoice register/detail, payment and dues, inventory, reports, shop/tax/print/legal/user/security settings, data requests, Privacy Policy, Terms, About/Support, four print layouts, offline shell, health.

## Decisions made without stopping the build

- Invoice prices are tax-exclusive. Quantity is a positive integer (pairs/pieces/services); the unit label is configurable per line. The UI states the pricing basis.
- Overall discounts use largest-remainder allocation over post-line-discount values. Rates are integer basis points; CGST/SGST are rounded independently to paise. Final rounding is half-up to whole rupees.
- A full-value credit closes the original balance. Cash refund is an explicit reversing payment; the system never silently moves cash. Cancellations require zero net payments and no credits.
- Invoice numbering uses one shared series for invoices and credits, an atomic counter, FY derived in Asia/Kolkata, a 1–4 character prefix and at least four sequence digits. Overflow beyond 16 characters is rejected transactionally.
- Erasure is a durable two-step workflow: database anonymisation plus storage deletion outbox. Completion is recorded only after objects have been removed through Storage API. Invoice tax snapshots remain retained. Financial retention is not a simple six years from invoice date; see LEGAL-REVIEW.md.
- Owner enters and publishes shop-specific policy/terms text; editorial templates in docs help prepare it. No fictional shop identity or legal policy is silently published.
- External IRP integration remains a feature-flagged hook as requested.

Each phase has build, run, validation and limitations in PHASES.md. RLS policy matrix is in SECURITY.md. Full schema is the ordered migration files.
