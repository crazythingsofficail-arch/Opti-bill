import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/[resource]/route";
import { createSessionToken } from "@/lib/auth-security";

describe("BUG-006: File Upload Validation & Security", () => {
  const sessionToken = createSessionToken("test-user");

  it("rejects non-image files with fake extensions (e.g. text/html script named fake.png)", async () => {
    const fakeContent = Buffer.from("<script>alert('xss')</script>");
    const formData = new FormData();
    const fakeFile = new File([fakeContent], "fake.png", { type: "image/png" });
    formData.append("file", fakeFile);
    formData.append("order_id", "test-order-1");

    const req = new NextRequest("http://localhost:3001/api/lens-upload", {
      method: "POST",
      headers: {
        cookie: `opti-activity=${sessionToken}`,
      },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ resource: "lens-upload" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid image format/i);
  });

  it("rejects oversized files exceeding 10MB", async () => {
    // 11MB buffer of dummy bytes
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    const formData = new FormData();
    const largeFile = new File([largeBuffer], "large.jpg", { type: "image/jpeg" });
    formData.append("file", largeFile);

    const req = new NextRequest("http://localhost:3001/api/lens-upload", {
      method: "POST",
      headers: {
        cookie: `opti-activity=${sessionToken}`,
      },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ resource: "lens-upload" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/exceeds 10MB limit/i);
  });

  it("accepts valid JPEG and PNG files with proper magic bytes", async () => {
    // Valid PNG 1x1 pixel magic bytes header
    const validPngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
    const formData = new FormData();
    const validFile = new File([validPngBytes], "lens-photo.png", { type: "image/png" });
    formData.append("file", validFile);
    formData.append("order_id", "valid-order-1");

    const req = new NextRequest("http://localhost:3001/api/lens-upload", {
      method: "POST",
      headers: {
        cookie: `opti-activity=${sessionToken}`,
      },
      body: formData,
    });

    const res = await POST(req, { params: Promise.resolve({ resource: "lens-upload" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toMatch(/^\/uploads\/lens-[a-f0-9-]+\.png$/);
  });
});
