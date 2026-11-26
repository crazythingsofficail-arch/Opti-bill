import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/[resource]/route";
import { createSessionToken } from "@/lib/auth-security";

describe("BUG-002, BUG-003, BUG-004: API Auth Guard & Password Security", () => {
  it("rejects unauthenticated requests to protected endpoints with 401", async () => {
    const req = new NextRequest("http://localhost:3001/api/reports");
    const res = await GET(req, { params: Promise.resolve({ resource: "reports" }) });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/Authentication required/i);
  });

  it("allows access to protected endpoints with a valid signed session token", async () => {
    const validToken = createSessionToken("test-user-id");
    const req = new NextRequest("http://localhost:3001/api/context", {
      headers: {
        cookie: `opti-activity=${validToken}`,
      },
    });
    const res = await GET(req, { params: Promise.resolve({ resource: "context" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shop).toBeDefined();
    expect(body.profile).toBeDefined();
  });

  it("rejects requests with forged or expired session tokens with 401", async () => {
    const req = new NextRequest("http://localhost:3001/api/customers", {
      headers: {
        cookie: "opti-activity=forged.invalid.token",
      },
    });
    const res = await GET(req, { params: Promise.resolve({ resource: "customers" }) });

    expect(res.status).toBe(401);
  });

  it("authenticates valid credentials on /api/login and returns signed session cookie", async () => {
    const req = new NextRequest("http://localhost:3001/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@opti-x.in", password: "LFR@26-1204" }),
    });
    const res = await POST(req, { params: Promise.resolve({ resource: "login" }) });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("opti-activity=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("rejects invalid login credentials with 400", async () => {
    const req = new NextRequest("http://localhost:3001/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@opti-x.in", password: "IncorrectPassword!" }),
    });
    const res = await POST(req, { params: Promise.resolve({ resource: "login" }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unable to log in/i);
  });

  it("authenticates with APP_USER username and APP_PASSWORD", async () => {
    const prevUser = process.env.APP_USER;
    const prevPass = process.env.APP_PASSWORD;
    process.env.APP_USER = "optixowner";
    process.env.APP_PASSWORD = "CustomPassword#2026";
    try {
      const req = new NextRequest("http://localhost:3001/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "optixowner", password: "CustomPassword#2026" }),
      });
      const res = await POST(req, { params: Promise.resolve({ resource: "login" }) });
      expect(res.status).toBe(200);
    } finally {
      if (prevUser === undefined) delete process.env.APP_USER;
      else process.env.APP_USER = prevUser;
      if (prevPass === undefined) delete process.env.APP_PASSWORD;
      else process.env.APP_PASSWORD = prevPass;
    }
  });
});
