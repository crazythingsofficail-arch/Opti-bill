# Deployment guide

## Supported deployment

Use a Node.js 22+ host supporting Next.js App Router, server route handlers, outbound HTTPS and filesystem access to packaged fonts. Vercel or a Node server behind an HTTPS reverse proxy are suitable targets. This source targets Next.js directly; it is not a Cloudflare Worker or a static export.

Set all environment variables from `.env.example` in the host. Keep `SUPABASE_SERVICE_ROLE_KEY`, `APP_SECRET`, `CRON_SECRET` and error webhook credentials server-only. Rotate them if disclosed. `APP_URL` must exactly match the public HTTPS origin; Origin validation rejects writes from other origins. Do not set wildcard CORS. Only the public URL and anon key use the `NEXT_PUBLIC_` prefix.

```bash
npm ci
npm run typecheck
npm test
npm run build
npm start
```

The checked-in lockfile pins the resolved dependencies. Update dependencies deliberately, run the tests and audit, and keep the lockfile committed. `public/fonts/` and `public/` must be included in deployment. React-PDF uses the bundled TTF paths at runtime; do not deploy only `.next` without these assets.

If using a reverse proxy, preserve the true Origin header and HTTPS scheme. Set request body limits to 500 KB for JSON routes and around 1 MB for uploads. Allow only the application’s public origin. Serve `/sw.js` with short/no-cache revalidation and avoid CDN caching of `/api`, `/share`, `/print`, authenticated HTML or cookies.

## Database and Auth

1. Provision Supabase in Mumbai (`ap-south-1`). Region is selected when the project is created; the code cannot move a project to Mumbai.
2. Apply migrations 001–006 in order. The only initial rows are private Storage bucket configuration, not product records.
3. Enable email/password, email confirmation, 12-character minimum password and TOTP enrollment/verification. Align Auth password rules with the application’s uppercase/lowercase/number requirements. Disable anonymous sign-in.
4. Configure a production SMTP service, delivery domain and verified sender. The app sends no test invitations during build.
5. Set Site URL and redirect allowlist to your exact origin plus `/auth/callback` and `/reset-password`. `signUp`, invitations and reset links use the PKCE code flow through `/auth/callback`; test the email provider’s `ConfirmationURL` flow end to end. If your customised templates use token hashes instead of authorization codes, adapt the callback to call `verifyOtp` with a validated token type before rollout. Do not silently mix the two flows.
6. Configure Supabase Auth’s own IP/email rate limits. Application login/reset/signup limits are durable database counters keyed by an HMAC of the account identity. Recovery responses avoid confirming account existence.
7. Set sensible JWT and maximum session lifetimes in Supabase. The app also enforces a signed 30-minute activity timeout. HttpOnly session cookies are Secure in production and SameSite=Lax.
8. Test invitation acceptance, password reset, inactive member denial, MFA challenge and owner requirement before inviting staff.
9. Generate linked-project types with `npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/supabase/database.generated.ts`, or run `npm run db:types` with a local Supabase stack running.
10. Configure the deletion worker and backups described in OPERATIONS.md.

## First-run shop configuration

Owner sign-up creates no shop until the onboarding transaction succeeds. Onboarding creates the shop and owner together. Non-owner role changes cannot be self-initiated. A second owner must change an owner’s own access, avoiding accidental self-lockout through the app.

Enter GST scheme and state, legal identity and GSTIN where applicable, invoice prefix, recipient-address threshold, HSN digit policy, effective tax rows, print declarations, policies and privacy version. Settings must represent the actual operator. Publishing changed legal text requires a new version. A valid GSTIN format/checksum does not verify that a registration is active; check registration externally.

For policy publication, replace editorial bracketed fields in the documents before pasting. The API enforces completeness/length and versioning, but cannot certify the truth of legal representations. The live pages render the database text as text, not HTML.

## Preview and tests

Without Supabase variables, the app displays a setup notice at login. It does not load sample patients or pretend a database exists. `/health` returns 503 `configuration_required` until public connection variables are set; after that it is a liveness/configuration check, not proof of database/SMTP readiness.

```bash
npx playwright install chromium
# Start the app in another terminal first.
npm run test:e2e
```

For the connected billing workflow, use a **dedicated test shop** and environment variables `E2E_ALLOW_TEST_WRITES=1`, `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD`, and `E2E_BASE_URL`. Have at least one effective tax category and complete policies. The workflow deliberately leaves audit-preserving test invoices in the disposable test project. Never use production shop credentials for fixture tests.

The delivered acceptance checklist covers 360 px width, complete keyboard navigation, mobile touch use, actual A4/80 mm print output and network loss. Run Lighthouse on a production build on the chosen host and realistic authenticated screens. A score of 90 is a target, not a measured result in this package.

## Rollout

Use a staging project, complete acceptance and restore drills, then migrate a clean production project. Keep a release archive of the migration set, lockfile and build commit. Monitor `/health`, failed-request IDs, Auth delivery, storage deletion backlog, database size and backup age. Logs intentionally omit raw customer details and prescriptions.
