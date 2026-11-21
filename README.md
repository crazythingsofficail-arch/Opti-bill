# Opti-X Billing

A Next.js + Supabase workspace for an Indian optical shop: customers, prescriptions, orders, GST billing, payments, inventory, reports and printing. Clean Roboto typography, light/dark mode, desktop sidebar and mobile bottom tabs. No business data is preloaded.

**Start here:** extract the ZIP, open the `opti-x-billing` folder, then follow the steps below. This is the application source, not an already provisioned hosted service. You supply the Supabase project and real shop configuration. No credentials are included.

## 1. Install

Use Node.js 22 or newer (validated with Node 24).

```bash
npm ci
```

Copy `.env.example` to `.env.local`. On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

On macOS/Linux:

```bash
cp .env.example .env.local
```

## 2. Connect Supabase

Create a Supabase project in **Mumbai / ap-south-1**. Fill in these values in `.env.local`:

| Variable                        | Purpose                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project API URL                                                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key; never put a service key here                                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only invitations, durable rate limits and storage erasure worker        |
| `APP_URL`                       | `http://localhost:3000` for development; your exact HTTPS origin in production |
| `APP_SECRET`                    | Random secret, at least 32 characters                                          |
| `CRON_SECRET`                   | Separate random secret for the deletion worker                                 |
| `SESSION_TIMEOUT_MINUTES`       | Signed server session activity timeout; default 30                             |

Generate each random secret separately with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Apply the migrations in filename order using the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Alternatively execute each complete SQL file from `supabase/migrations/` in the project SQL editor, in order. Do not run partial statements. Do not insert seed data.

In Supabase Auth, set the Site URL to `APP_URL`, enable email confirmation, configure transactional SMTP, and allow the `/auth/callback` and `/reset-password` redirect URLs on that origin. Use PKCE authorization-code callbacks. See `docs/DEPLOYMENT.md` for the exact email-template and session checks.

## 3. Run and configure your shop

```bash
npm run dev
```

Open `http://localhost:3000`.

1. Choose **First-time owner setup** on the sign-in screen. Create an account and confirm the email.
2. Sign in and enter the real shop details, GST scheme, invoice prefix and recipient-address threshold.
3. In **Settings → Shop & policies**, publish the shop-specific privacy notice, terms and consent wording. Editable editorial templates are in `docs/`. Set print terms, warranty/returns policy and declarations. Shop-field tokens in the supplied templates resolve from Settings; replace any additional editorial instructions before publication.
4. Add actual effective-dated HSN/SAC categories and GST rates under **Tax categories**, including a zero-rate category when applicable. No rate or HSN is selected on your behalf.
5. Optionally add frames, logo, authorised signature and members. Test owner/staff/optometrist access in a separate test project.
6. Create the first customer and bill. The application captures guardian verification and consent for under-18s.

A public, shop-specific privacy/terms notice is available at `/policy/SHOP_UUID` after publication. The shop UUID is visible in the database; it is an identifier, not a secret.

## Daily workflow

**New bill → Customer → Prescription → Items → Review & pay.** Search phone first, reuse a prescription or enter one, add frame/lens details, optionally attach one compressed lens photo, add split payments and finalise. Save drafts online; autosave starts once a customer is selected. Draft references are placed in the URL so the same draft can be reopened. No clinical records are put in local storage.

Finalisation checks current effective rates again on the server, snapshots the bill, consumes stock, issues an atomic FY-wise number and appends payments in a transaction. A double tap with the same idempotency key cannot create two bills. Failed finalisation rolls back the number and stock movement.

Issued invoice document fields are immutable. Balances are projected from append-only payments. Owners may reverse a payment, cancel a zero-net-paid invoice or issue one full credit note. Refunds are explicitly recorded; the app does not move money. Restocking requires an explicit indication that the frame physically returned.

## Print and share

The invoice detail opens an A4 invoice, A5 lab job card without prices, 80 mm thermal receipt, or prescription slip. Each has browser print and server PDF output. Disable browser headers/footers for clean browser printing. The tested Roboto font includes the rupee glyph. Thermal layouts omit images.

WhatsApp buttons open a prefilled message for the operator to review/send. PDF share links are signed and expire after one hour; they include the prescription and photo where present. Image URLs expire after 60 seconds. See `docs/SECURITY.md` for link handling.

## Production Readiness, Hardening & Security

This codebase has undergone a comprehensive adversarial QA audit and production hardening:
- **Persistence Hardening (BUG-001)**: Writes to `data/store.json` use atomic temp-file creation and rename with automated rolling backups in `data/store.json.bak` and corruption auto-recovery.
- **Authentication Security (BUG-002, BUG-003, BUG-004)**: Cryptographically signed HMAC-SHA256 session tokens with timestamp expiration; constant-time scrypt password verification; zero unauthenticated API bypass.
- **Brute-Force Protection (BUG-005)**: In-memory rate limiting locks out unauthorized login attempts after 5 consecutive failures within a 15-minute window with `429 Too Many Requests` and `Retry-After` header.
- **Upload Hardening (BUG-006)**: Validates binary magic byte headers (JPEG, PNG, WebP) and enforces a strict 10MB size limit.
- **Complete Core Workflows (BUG-007, BUG-008, BUG-009, BUG-010, BUG-011)**: Full implementation of credit notes, invoice cancellation with restock, payment reversals, order tracking, tax categories, brand image management, and DPDP customer data rights.
- **Concurrency & Idempotency (BUG-012)**: Invoice finalisation is strictly idempotent and sequence-guarded against double-submits.
- **CSV & Output Sanitization (BUG-013)**: Safe quoting and escaping across all report exports.
- **Health Diagnostics (BUG-014)**: Live store readability and diagnostics exposed on `/health` and `/api/health`.

## Backup and Restore Instructions

### Automated Backups
Opti-X automatically updates `data/store.json.bak` on every persisted state change. In the event of a sudden power outage, process termination, or disk corruption:
1. `getStore()` detects corrupt or 0-byte JSON in `data/store.json`.
2. It automatically recovers all tables, invoices, customers, and orders from `data/store.json.bak`.

### Manual Backup
To create an offline snapshot of your data:
```bash
# Windows PowerShell
Copy-Item data/store.json "backups/store-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"

# Linux / macOS
cp data/store.json backups/store-backup-$(date +%Y%m%d-%H%M%S).json
```

### Manual Restore
To restore from a backup:
1. Stop the application server (`npm run stop` or kill the process).
2. Copy your desired backup JSON over `data/store.json`:
   ```bash
   cp backups/store-backup-YYYYMMDD.json data/store.json
   ```
3. Restart the server (`npm start` or `npm run dev`).
4. Run the smoke test:
   ```bash
   node scripts/smoke-test.mjs http://localhost:3000
   ```

## Production Smoke Testing
Run post-deploy verification against any live instance:
```bash
# Test local deployment
node scripts/smoke-test.mjs http://localhost:3000

# Test remote deployment
node scripts/smoke-test.mjs https://billing.yourshop.in
```

## Commands

| Command             | What it does                                                  |
| ------------------- | ------------------------------------------------------------- |
| `npm run dev`       | Development server                                            |
| `npm run typecheck` | Strict TypeScript checks                                      |
| `npm test`          | Complete unit and integration test suite (Vitest)             |
| `npm run test:e2e`  | Playwright tests against a running app                        |
| `npm run build`     | Optimized production build (Next.js + Webpack)                |
| `npm start`         | Serve production build                                        |
| `npm run format`    | Format source and documentation                               |

`src/supabase/database.generated.ts` is an introspected offline schema snapshot, including RPC signatures. It is generated by `scripts/generate-schema-types.mts`, not by a connected Supabase CLI session. Before deployment regenerate with the documented Supabase CLI command, which also supplies relationship metadata.

## Read before production use

- `docs/PHASES.md`: work completed in all nine phases and scope choices.
- `docs/ARCHITECTURE.md`: schema, flow, money conventions and screen list.
- `docs/SECURITY.md`: complete role/RLS matrix and trust boundaries.
- `docs/DEPLOYMENT.md`: hosting, Auth, configuration and acceptance setup.
- `docs/OPERATIONS.md`: backup, restore, erasure worker and rollback.
- `docs/LEGAL-REVIEW.md`: official legal sources and configuration decisions.
- `docs/TEST-RESULTS.md`: checks actually run and checks still requiring a configured stack.

A successful source build is not an audited production rollout. Live Supabase Auth/Storage integration, real multi-connection concurrency, physical printers, mobile performance and the two-minute counter workflow must be accepted on the installed shop system. The bundled tests and procedures make those checks repeatable. IRP integration is intentionally not implemented; enabling the e-invoicing-required flag blocks finalisation.

Made by Mudasir Shariff | opti-x.in | Support: hello@opti-x.in
