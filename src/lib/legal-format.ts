import type { Shop } from "./types";
export const policyTokens = [
  "name",
  "legal_name",
  "address",
  "city",
  "state",
  "pincode",
  "phone",
  "email",
  "grievance_name",
  "grievance_email",
  "retention_months",
  "clinical_retention_months",
] as const;
export function renderPolicy(text: string, shop: Partial<Shop>): string {
  return text.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => {
    if (!(policyTokens as readonly string[]).includes(key))
      throw new Error("Unknown policy field");
    return String(shop[key as (typeof policyTokens)[number]] ?? "");
  });
}
export function validPolicyTokens(text: string): boolean {
  return [...text.matchAll(/\{\{([^}]+)\}\}/g)].every((m) =>
    (policyTokens as readonly string[]).includes(m[1]),
  );
}
