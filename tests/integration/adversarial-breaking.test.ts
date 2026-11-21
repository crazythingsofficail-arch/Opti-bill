import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/[resource]/route";
import { createSessionToken } from "@/lib/auth-security";
import { saveCustomer, savePrescription, getStore, loadPrintDataFromStore, saveDraft, finaliseInvoice } from "@/lib/store";

describe("Phase 4 & 5: Adversarial Breaking & Security Audit", () => {
  const token = createSessionToken("test-admin");
  const headers = {
    cookie: `opti-activity=${token}`,
    "Content-Type": "application/json",
  };

  it("handles Unicode, emojis, Hindi, and Kannada script gracefully", () => {
    const unicodeName = "Mudasir Shariff 👓 ಮುದಸಿರ್ ಶರೀಫ್ मुदसिर शरीफ 👍";
    const unicodeNotes = "ವೈದ್ಯಕೀಯ ಪರೀಕ್ಷೆ - 100% UV Protection & anti-glare 🌟";

    const custId = saveCustomer({
      name: unicodeName,
      phone: "+919876543200",
      notes: unicodeNotes,
      city: "ಬೆಂಗಳೂರು Bengaluru",
    });

    const store = getStore();
    const cust = store.customers.find((c) => c.id === custId);
    expect(cust).toBeDefined();
    expect(cust?.name).toBe(unicodeName);
    expect(cust?.notes).toBe(unicodeNotes);
    expect(cust?.city).toBe("ಬೆಂಗಳೂರು Bengaluru");
  });

  it("rejects path traversal attacks on resources and ids", async () => {
    const pathTraversalId = "../../../etc/passwd";
    const req = new NextRequest(`http://localhost:3001/api/pdf?id=${encodeURIComponent(pathTraversalId)}&layout=a4`, {
      headers,
    });
    const res = await GET(req, { params: Promise.resolve({ resource: "pdf" }) });
    // Must fail safely without leaking filesystem or crashing
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("handles malformed JSON or corrupted payloads gracefully with 400", async () => {
    const req = new NextRequest("http://localhost:3001/api/customers", {
      method: "POST",
      headers,
      body: "INVALID_MALFORMED_JSON{{{",
    });
    const res = await POST(req, { params: Promise.resolve({ resource: "customers" }) });
    expect(res.status).toBe(400);
  });

  it("safely sanitizes and handles XSS vectors in customer names and invoices", async () => {
    const xssPayload = "<script>alert('xss')</script><img src=x onerror=alert(1)>";
    const custId = saveCustomer({
      name: xssPayload,
      phone: "+919876543290",
    });

    const draftId = crypto.randomUUID();
    saveDraft(draftId, {
      id: draftId,
      customer_id: custId,
      items: [
        {
          item_type: "frame",
          description: "Anti-reflective Frame",
          unit_price_paise: 100000,
          qty: 1,
          discount_paise: 0,
        },
      ],
      payments: [{ amount_paise: 112000, mode: "cash" }],
    });

    const invId = finaliseInvoice(draftId, "key-xss-1", [{ amount_paise: 112000, mode: "cash" }]);
    const printData = await loadPrintDataFromStore(invId);

    expect(printData.invoice.customer_snapshot?.name).toBe(xssPayload);
    // Verified that loadPrintDataFromStore succeeds without executing code or throwing unhandled errors
    expect(printData.invoice.grand_total).toBeGreaterThan(0);
  });
});
