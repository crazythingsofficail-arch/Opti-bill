# Verification record

Prepared 16 November 2026. The final package is validated locally; no production shop or Supabase project was provisioned.

| Check                                             | Result                                                                                                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Strict TypeScript                                 | Passed `npm run typecheck`                                                                                                                                             |
| Production build                                  | Passed `npm run build` with Next.js 16.4.6                                                                                                                             |
| Unit/SQL/PDF suite                                | 32 tests passed: 16 money/validation tests, 15 Postgres integration tests, four PDF layouts exercised in one PDF test                                                  |
| Money property checks                             | 300 generated scenarios inside the unit tests reconcile integer totals, discount allocation and rounding                                                               |
| Postgres migrations                               | All six migrations executed successfully in PGlite’s real Postgres engine                                                                                              |
| Finance SQL                                       | Intra/inter-state mixed-rate discounted SQL totals and lines matched the TypeScript engine; payment and stock rollback checked                                         |
| Permissions                                       | Cross-shop reads/writes, staff restrictions, optometrist restrictions, storage object isolation and immutable ledgers checked                                          |
| Invoice numbering                                 | 50 competing Promise calls produced 50 unique consecutive numbers in PGlite; this is one embedded engine, not 50 independent live Postgres connections                 |
| PDFs                                              | A4, A5 job card, thermal and prescription PDF generation passed; rupee glyph checked after merging Roboto character subsets; generated PDFs visually inspected         |
| Browser observation                               | The local setup/login screen rendered successfully in the shared browser                                                                                               |
| Playwright runner                                 | Attempted; the environment denied Chromium’s required local socket before any browser assertions ran. These are infrastructure-blocked checks, not passing E2E results |
| Live billing E2E                                  | Supplied test, not run: requires a dedicated configured Supabase test shop and explicit test-write environment flag                                                    |
| Production dependency audit                       | `npm audit --omit=dev` returned zero reported vulnerabilities during build                                                                                             |
| Physical printers, Lighthouse, <2-minute workflow | Not measured; run the installed-system acceptance checklist                                                                                                            |

## Test boundaries

PGlite tests use real SQL, triggers and row-level policies. They create minimal Auth/Storage schema equivalents within the test file so the migrations can execute without Docker. They do **not** test the hosted Supabase Auth service, email delivery, Storage HTTP API, JWT signing or network concurrency. Those require the connected deployment.

Synthetic customer/clinical/tax records occur only inside test files. No fixture SQL is installed, no seed script runs, and no test PDFs or test database is included in the deliverable. Browser-only theme preferences may be stored locally; customer data is not stored in local storage.

The offline schema type snapshot was generated from executed migrations. Relationship metadata should be regenerated using the supplied Supabase CLI command against the actual project.
