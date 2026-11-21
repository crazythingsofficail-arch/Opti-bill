export const en = {
  product: "Opti-X Billing",
  home: "Home",
  customers: "Customers",
  newBill: "New bill",
  orders: "Orders",
  more: "More",
  invoices: "Invoices",
  payments: "Payments & dues",
  inventory: "Inventory",
  reports: "Reports",
  settings: "Settings",
  privacy: "Privacy policy",
  terms: "Terms of use",
  support: "About & support",
  search: "Search customers or invoices",
  noResults: "No results found",
  retry: "Try again",
  save: "Save",
  cancel: "Cancel",
  next: "Continue",
  back: "Back",
} as const;
export type TranslationKey = keyof typeof en;
export type Locale = "en";
export function t(key: TranslationKey, _locale: Locale = "en") {
  return en[key];
}
export const BRAND_FOOTER =
  "Made by Mudasir Shariff | opti-x.in | Support: hello@opti-x.in";
