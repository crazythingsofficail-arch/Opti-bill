# Security and RLS policy matrix

## Database access

Every public business table and the private rate-limit table has row-level security enabled. Application roles receive SELECT only; table INSERT/UPDATE/DELETE is revoked. All normal writes use validated, narrowly scoped security-definer RPCs. Each RPC fixes its search path and resolves the active profile through `auth.uid()`. Cross-shop child references use composite foreign keys. There is no user-supplied `shop_id` in normal mutation bodies.

| Table / view           | Owner read           | Staff read           | Optometrist read     | Mutations                                                                           |
| ---------------------- | -------------------- | -------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| shops                  | Own shop             | Own shop             | Own shop             | create_shop onboarding; save_settings/set_shop_asset/set_mfa_requirement owner      |
| profiles               | Own shop             | Self                 | Self                 | owner change_member; server attach_member after owner check                         |
| customers              | Own active customers | Own active customers | Own active customers | owner/staff save_customer; owner erase_customer                                     |
| prescriptions          | Own active records   | Own active records   | Own active records   | all three roles save_prescription; used invoice prescriptions require a new version |
| frames                 | Own shop             | Own shop             | None                 | owner save_catalog; transactionally adjusted by billing/correction RPCs             |
| tax_categories         | Own shop             | Own shop             | None                 | owner save_catalog; used categories cannot be edited                                |
| orders/order_items     | Own shop             | Own shop             | None                 | owner/staff draft save and order progress RPC; finalised item details stay fixed    |
| invoices/invoice_items | Own shop             | Own shop             | None                 | owner/staff finalise; owners credit; finalised document rows reject UPDATE/DELETE   |
| invoice_balances       | Own shop             | Own shop             | None                 | payments trigger only                                                               |
| invoice_cancellations  | Own shop             | Own shop             | None                 | owner append-only cancel RPC                                                        |
| invoice_register       | Own shop             | Own shop             | None                 | security-invoker view; no direct writes                                             |
| payments               | Own shop             | Own shop             | None                 | owner/staff append payment; owner append reversal                                   |
| invoice_counters       | Own shop             | None                 | None                 | private transaction function only                                                   |
| invoice_clinical       | Own shop             | Own shop             | None                 | finalisation snapshot; owner erasure deletes health content                         |
| uploads                | Own shop             | Own shop             | None                 | owner/staff registration/removal RPC; one active lens image per order               |
| data_requests          | Own shop             | None                 | None                 | owner request, resolution and erasure RPCs                                          |
| storage_deletions      | Own shop             | None                 | None                 | registration/erasure outbox; server worker marks successful deletions               |
| audit_logs             | Own shop             | None                 | None                 | triggers/export logging append only; UPDATE/DELETE rejected                         |
| legal_versions         | Own shop             | None                 | None                 | owner publication inserts version; UPDATE/DELETE rejected                           |
| private.rate_limits    | None                 | None                 | None                 | server-only rate-limit function                                                     |

`my_shop()` and `my_role()` are security-definer lookup helpers to avoid recursive profile policies. Missing/inactive users have no business scope. The public `public_policy(shop_uuid)` RPC returns only published operator/policy fields; it does not expose customer or financial data.

Every owner mutation enforces configured owner MFA at SQL level through `require_role`. The server also requires AAL2 for owner application access when enabled. Direct SELECT policies still depend on authenticated role/shop, so configure Supabase Auth session protection in addition to the UI setting; do not treat the app’s MFA toggle as a universal external API-read policy.

## Storage

`lens-images` and `shop-assets` are private. Lens object names are `shop_uuid/customer_uuid/random_uuid.webp`. Storage inserts validate the first folder, role, active customer and filename shape. Read policy requires a same-shop, non-deleted registered upload. Cross-shop object SELECT is denied, which also blocks signing another shop’s objects using a user session.

Shop branding is stored at `shop_uuid/assets/random_uuid.webp`. Only owners upload branding; owner/staff can read same-shop assets. A new branding upload uses a new path so old invoice snapshots keep their original assets. Neither bucket permits direct authenticated deletion. The server deletes only keys selected by the authorised workflow/outbox. No public bucket or unrestricted image URL is used. Signed object URLs expire in 60 seconds.

An uploaded file must be a WebP <=300 KB and pass a RIFF/WEBP signature check. The browser decodes/re-encodes the image through canvas before upload, which removes ordinary original metadata. Network drop errors are shown; financial/image writes are not queued offline. Upload-registration failure attempts to remove the unregistered object; crash-time orphan reconciliation remains an operational task.

## Web boundary

Same-origin mutations validate Origin against APP_URL. Zod validates every form action and route payload. Authentication uses `@supabase/ssr`, HttpOnly cookie storage and server `getUser()` verification. Secure cookies, HSTS, frame denial, nosniff, no-referrer and restrictive permissions headers are set. Request-specific CSP nonces protect scripts; inline styles are allowed for React layout/style attributes. Sensitive responses use `private, no-store` and the service worker caches only the generic offline shell and public static assets.

An HMAC-signed activity cookie enforces the configured idle timeout. Supabase’s session lifetime/revocation controls remain the authoritative protection when credentials are used outside this app. Durable account-scoped login/reset limits use HMAC identifiers; a Supabase outage fails these flows closed. Deploy behind a correctly configured HTTPS proxy and enable Supabase’s own Auth rate limits.

React text rendering escapes customer/shop input. Policy pages render plain text with a whitelist of shop-field substitutions. CSV exports prefix formula-leading cells. Financial idempotency keys and invoice row locks prevent payment/finalisation duplicates. Draft version checks prevent silent overwrites.

## Service key and links

Service-role access is limited to server modules for invitations, rate-limit counters, the deletion worker and signed-share PDF generation. Share tokens bind invoice UUID, shop UUID and expiry with APP_SECRET. The server checks the signature and expiry before querying, and filters by both invoice/shop IDs. A share link is a bearer credential: anyone possessing it can view that document until expiry. Do not put it into analytics or public logs. Regenerate a link after expiry; rotating APP_SECRET invalidates all outstanding links.

The app does not send WhatsApp messages itself. Operators review and send the prepared message. Payment reminders link to the current customer phone, while immutable tax snapshots omit phone/email/age. Staff may print/download individual invoices as part of counter work. Owner-only report/access exports do not prevent a staff member from manually copying data they are otherwise allowed to read.

## Audit and monitoring

Logs contain only event names, request IDs, error class and explicitly permitted operational metadata. Raw phone numbers, prescriptions, image data, full request bodies and signed URLs are not logged. Audit rows record entity IDs, action and changed field names; they do not retain raw old customer medical/contact values after erasure. Financial snapshots and append-only payment details remain in their proper tables.

`ERROR_WEBHOOK_URL` is an optional integration seam and is off by default. Use it for a small redacted event adapter if connecting Sentry. Do not attach raw request context. CI audits production and development dependencies and checks source types, unit/SQL/PDF tests and browser smoke tests on a standard runner.

The database administrator and service-role key inherently bypass normal RLS. Restrict those credentials operationally, audit their use and keep them out of staff browsers. This implementation is not a third-party penetration-test report.
