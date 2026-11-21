import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getStore, saveStore, resetMemoryStoreForTesting, DEFAULT_SHOP, getDataDir, getStorePath, getBackupPath, type LocalStore } from "@/lib/store";

describe("BUG-001: Atomic Persistence & Corruption Protection", () => {
  const dataDir = getDataDir();
  const storePath = getStorePath();
  const backupPath = getBackupPath();
  let originalStoreContent: string | null = null;

  beforeEach(() => {
    if (fs.existsSync(storePath)) {
      originalStoreContent = fs.readFileSync(storePath, "utf8");
    }
  });

  afterEach(() => {
    if (originalStoreContent !== null) {
      fs.writeFileSync(storePath, originalStoreContent, "utf8");
    }
  });

  it("creates a .bak file on saveStore and performs atomic writes", () => {
    const store = getStore();
    const testCustomer = {
      id: "99999999-0000-4000-8000-000000000001",
      shop_id: DEFAULT_SHOP.id,
      name: "Atomic Test Customer",
      phone: "+919999999999",
      alt_phone: null,
      gender: "other",
      dob: null,
      age_years: 30,
      email: null,
      address: null,
      city: null,
      state_code: "29",
      gstin: null,
      notes: null,
      consent_given: true,
      consent_at: new Date().toISOString(),
      consent_version: "v1",
      guardian_name: null,
      guardian_phone: null,
      guardian_consent: false,
      guardian_verification: null,
      created_at: new Date().toISOString(),
      anonymised_at: null,
    };
    store.customers.push(testCustomer);
    saveStore(store);

    expect(fs.existsSync(storePath)).toBe(true);
    expect(fs.existsSync(backupPath)).toBe(true);

    const readBack = JSON.parse(fs.readFileSync(storePath, "utf8"));
    expect(readBack.customers.some((c: any) => c.name === "Atomic Test Customer")).toBe(true);
  });

  it("recovers from .bak backup if store.json is truncated or corrupt instead of wiping database", () => {
    const store = getStore();
    store.customers = [
      {
        id: "88888888-0000-4000-8000-000000000002",
        shop_id: DEFAULT_SHOP.id,
        name: "Precious Customer Data",
        phone: "+919888888888",
        alt_phone: null,
        gender: "female",
        dob: null,
        age_years: 25,
        email: null,
        address: null,
        city: null,
        state_code: "29",
        gstin: null,
        notes: null,
        consent_given: true,
        consent_at: new Date().toISOString(),
        consent_version: "v1",
        guardian_name: null,
        guardian_phone: null,
        guardian_consent: false,
        guardian_verification: null,
        created_at: new Date().toISOString(),
        anonymised_at: null,
      },
    ];
    saveStore(store);

    // Simulate power-cut truncation of store.json (0 bytes or partial write)
    fs.writeFileSync(storePath, "{ partial corrupted json", "utf8");
    resetMemoryStoreForTesting();

    // Calling getStore() must NOT wipe data; it must recover from backupPath!
    const recoveredStore = getStore();
    expect(recoveredStore.customers.some((c: any) => c.name === "Precious Customer Data")).toBe(true);
  });
});
