# Legal and tax configuration review

Prepared 16 November 2026. This file explains implementation decisions; it is not a certificate of compliance or a substitute for the shop’s accountant/legal review.

## GST

CBIC Rule 46 specifies invoice particulars and a financial-year-unique series with a 16-character maximum. The app freezes supplier/recipient details, HSN/SAC, quantities, tax values, place of supply and numbered document data. Recipient-address thresholds and HSN digit policy are owner configuration. No rates or HSN codes are seeded. A format/checksum-valid GSTIN is not proof of active registration.

The requested “six years” retention description is implemented as a floor of 72 months, with no automatic accounting deletion. CGST section 36 measures the normal period from the annual-return due date for the relevant year and has extensions for specified proceedings. Simply deleting an invoice six years after issue would be unsafe. The retention policy and operations guide preserve this distinction.

The requested arithmetic convention is tax-exclusive pricing, line rounding to paise, largest-remainder discount allocation and final whole-rupee rounding. It is an explicit software convention for the accountant to approve, not a claim that every GST situation uses that exact rounding workflow. Fractional quantities, partial credits, return filing and automated IRP transmission are outside this version. A full credit uses the original tax snapshot. An owner must determine whether cancellation/credit is appropriate for the transaction and filing status.

## Data protection

The privacy/terms documents are original editorial drafts for the requested service, populated from real shop settings. They must match actual practices. DPDP Act rights and duties are relevant design inputs, but commencement is phased. The 2025 rules specify different commencement periods for different provisions; do not describe all substantive duties as already effective merely because the Act is dated 2023. Recheck the latest commencement notifications at rollout.

The application captures notice version and consent, requires guardian verification for minors, restricts roles, provides access/correction/erasure workflows and separates erasable clinical content from retained accounting identity. The older IT Act/SPDI framework and its transition should also be reviewed for medical/health-related records. The app does not certify a lawful basis, prove a guardian’s identity, fulfil a regulatory breach notification automatically or replace the operator’s grievance process.

The deployment region must actually be Mumbai before that claim is published. Application hosting, SMTP, analytics/error hooks and backups need their own geography/provider assessment. Avoid sending patient content to optional monitoring providers. Do not activate an e-invoicing-required shop without a valid IRP path: the flag deliberately blocks finalisation.

## Primary references consulted

- CBIC, CGST Rule 46: https://taxinformation.cbic.gov.in/content-page/explore-rules/1000136/1000001
- CBIC, CGST section 36: https://taxinformation.cbic.gov.in/content-page/explore-act/1000306/1000001
- India Code, Digital Personal Data Protection Act 2023: https://www.indiacode.nic.in/bitstream/123456789/22037/1/a2023-22.pdf
- MeitY, DPDP Rules 2025 Gazette: https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf
- Government PIB announcement and official Act/Rules links: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190655&lang=2&reg=48
- Supabase database backup scope: https://supabase.com/docs/guides/platform/backups

This project intentionally does not invent tax rates, turnover thresholds, HSN codes, operator identity or composition-declaration text. Obtain and configure the applicable values before live billing.
