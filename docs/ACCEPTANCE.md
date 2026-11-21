# Installed-system acceptance checklist

Run against a disposable staging shop with synthetic records. The product itself has no seed data. Record the release, device/browser, printer and test date next to each result.

| Check                                   | Expected result                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Owner onboarding and email confirmation | One shop and owner profile created together; no invented business records                                                 |
| Auth reset/invite links                 | Expiring email link reaches the intended callback and password flow                                                       |
| Roles                                   | Staff cannot change settings, cancel, credit, bulk-export or erase; optometrist writes only prescriptions                 |
| Two-shop API/RLS check                  | Cross-shop table reads/writes and Storage signing denied                                                                  |
| Required MFA and inactive member        | Correct challenge/denial; owner’s own role cannot be self-demoted                                                         |
| Customer and minor consent              | Phone uniqueness scoped to shop; notice version/time recorded; guardian verification required                             |
| Prescriptions                           | Quarter steps, signed power, nonzero cylinder requires axis, normal/unusual range handling                                |
| Draft recovery                          | Step navigation keeps data; reload draft URL restores entered lines/payment intent; stale writer receives conflict        |
| Money reconciliation                    | Discounted mixed-rate intra/inter-state invoices reconcile per line and to the displayed total                            |
| Numbering contention                    | Run 50 simultaneous real PostgREST finalisations; unique contiguous numbers, failed transaction does not consume a number |
| Double tap/network retry                | Same finalisation/payment key creates one ledger effect                                                                   |
| Frame inventory                         | Competing last-frame sales cannot both succeed; failed invoice rolls back stock                                           |
| Finalised record lock                   | Direct app-role UPDATE/DELETE denied and immutable trigger resists even privileged accidental edit                        |
| Correction/refund                       | Full credit references original rate/number; original balance closes; refund stays visible until explicit reversal        |
| Print                                   | A4, A5 and 80 mm output legible, no clipped totals/footer; lab job card contains no prices; rupee glyph prints correctly  |
| Share                                   | Signed PDF expires; wrong signature/shop fails; photo URLs expire at 60 seconds                                           |
| Erasure                                 | Clinical rows and snapshots removed; required tax identity remains; photo request pending until worker removes object     |
| Reports                                 | Sales net of credits, payment reversals included, HSN/rate breakdown reconciled; formula-safe owner CSV                   |
| Offline/PWA                             | Install on Android; offline shell contains no cached patient data; no write queue; reconnect allows retry                 |
| Mobile                                  | Complete workflow at 360 px; 48 px controls; no page overflow outside intended Rx table scroller                          |
| Keyboard/accessibility                  | Tab focus visible, dialogs trap focus, escape closes, Cmd/Ctrl+K and / search, N new bill                                 |
| Performance                             | Lighthouse mobile >=90 on a production build, realistic data volume and chosen host                                       |
| Counter timing                          | Trained staff complete a representative walk-in bill with prescription in under two minutes                               |
| Backup                                  | Daily private backup timestamp and object backup verified; successful restore drill recorded                              |

No physical-printer, performance-score or counter-timing result is asserted by this package. Test results are in TEST-RESULTS.md.
