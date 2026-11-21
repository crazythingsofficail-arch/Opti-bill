#!/usr/bin/env node

/**
 * Opti-X Billing Production Smoke Test Script
 * Runs post-deployment verification checks against a live instance.
 *
 * Usage:
 *   node scripts/smoke-test.mjs [baseUrl]
 * Example:
 *   node scripts/smoke-test.mjs http://localhost:3001
 */

const baseUrl = (process.argv[2] || process.env.APP_URL || "http://localhost:3001").replace(/\/$/, "");
const adminPassword = process.env.ADMIN_PASSWORD || "LFR@26-1204";
const adminEmail = process.env.ADMIN_EMAIL || "admin@opti-x.in";

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function report(step, success, message = "") {
  totalChecks++;
  if (success) {
    passedChecks++;
    console.log(`\x1b[32m✔ [PASS]\x1b[0m ${step} ${message}`);
  } else {
    failedChecks++;
    console.error(`\x1b[31m✖ [FAIL]\x1b[0m ${step} ${message}`);
  }
}

async function runSmokeTests() {
  console.log(`\n==================================================`);
  console.log(`🚀 Starting Opti-X Billing Smoke Tests on: ${baseUrl}`);
  console.log(`==================================================\n`);

  let sessionCookie = null;

  // 1. Health Endpoint Diagnostic Check
  try {
    const res = await fetch(`${baseUrl}/health`);
    if (res.status === 200) {
      const data = await res.json();
      if (data.status === "healthy" && data.store?.readable) {
        report("Health check (/health)", true, `[status: healthy, invoices: ${data.store.invoicesCount}]`);
      } else {
        report("Health check (/health)", false, `Invalid response payload: ${JSON.stringify(data)}`);
      }
    } else {
      report("Health check (/health)", false, `HTTP status ${res.status}`);
    }
  } catch (err) {
    report("Health check (/health)", false, `Connection error: ${err.message}`);
  }

  // 2. Unauthenticated API Guard (Security Verification)
  try {
    const res = await fetch(`${baseUrl}/api/context`);
    if (res.status === 401) {
      report("Auth Guard (GET /api/context)", true, "[correctly rejected with HTTP 401 Unauthorized]");
    } else {
      report("Auth Guard (GET /api/context)", false, `Expected 401 Unauthorized but got ${res.status}`);
    }
  } catch (err) {
    report("Auth Guard (GET /api/context)", false, err.message);
  }

  // 3. Manifest and Offline PWA Shell
  try {
    const resManifest = await fetch(`${baseUrl}/manifest.webmanifest`);
    const isManifestOk = resManifest.status === 200;
    const resOffline = await fetch(`${baseUrl}/offline.html`);
    const isOfflineOk = resOffline.status === 200;
    report("PWA Shell & Manifest", isManifestOk && isOfflineOk, `[Manifest: ${resManifest.status}, Offline: ${resOffline.status}]`);
  } catch (err) {
    report("PWA Shell & Manifest", false, err.message);
  }

  // 4. Login Authentication Flow (Signed Cookie Generation)
  try {
    const loginRes = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });

    if (loginRes.status === 200) {
      const rawCookie = loginRes.headers.get("set-cookie");
      if (rawCookie && rawCookie.includes("opti-activity=")) {
        sessionCookie = rawCookie.split(";")[0];
        report("Admin Login (/api/login)", true, "[signed HMAC session token received]");
      } else {
        report("Admin Login (/api/login)", false, "Missing opti-activity cookie in response headers");
      }
    } else {
      report("Admin Login (/api/login)", false, `HTTP status ${loginRes.status}`);
    }
  } catch (err) {
    report("Admin Login (/api/login)", false, err.message);
  }

  // 5. Authenticated Context Access
  if (sessionCookie) {
    try {
      const res = await fetch(`${baseUrl}/api/context`, {
        headers: { Cookie: sessionCookie },
      });
      if (res.status === 200) {
        const body = await res.json();
        report("Authenticated Context (/api/context)", true, `[shop: ${body.shop?.name}, role: ${body.profile?.role}]`);
      } else {
        report("Authenticated Context (/api/context)", false, `HTTP status ${res.status}`);
      }
    } catch (err) {
      report("Authenticated Context (/api/context)", false, err.message);
    }
  } else {
    report("Authenticated Context (/api/context)", false, "Skipped due to prior login failure");
  }

  // 6. Active Taxes Endpoint
  if (sessionCookie) {
    try {
      const res = await fetch(`${baseUrl}/api/active-taxes`, {
        headers: { Cookie: sessionCookie },
      });
      if (res.status === 200) {
        const body = await res.json();
        report("Taxes catalog (/api/active-taxes)", true, `[active tax categories: ${body.rows?.length || 0}]`);
      } else {
        report("Taxes catalog (/api/active-taxes)", false, `HTTP status ${res.status}`);
      }
    } catch (err) {
      report("Taxes catalog (/api/active-taxes)", false, err.message);
    }
  }

  // 7. Dashboard Stats Verification
  if (sessionCookie) {
    try {
      const res = await fetch(`${baseUrl}/api/dashboard`, {
        headers: { Cookie: sessionCookie },
      });
      if (res.status === 200) {
        report("Dashboard metrics (/api/dashboard)", true, "[dashboard statistics operational]");
      } else {
        report("Dashboard metrics (/api/dashboard)", false, `HTTP status ${res.status}`);
      }
    } catch (err) {
      report("Dashboard metrics (/api/dashboard)", false, err.message);
    }
  }

  console.log(`\n--------------------------------------------------`);
  console.log(`📊 Smoke Test Summary: ${passedChecks}/${totalChecks} checks passed.`);
  console.log(`--------------------------------------------------\n`);

  if (failedChecks > 0) {
    console.error(`\x1b[31m💥 Smoke test failed with ${failedChecks} error(s).\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m✨ All smoke tests passed cleanly. System is ready for production.\x1b[0m\n`);
    process.exit(0);
  }
}

runSmokeTests().catch((err) => {
  console.error("Unhandled smoke test exception:", err);
  process.exit(1);
});
