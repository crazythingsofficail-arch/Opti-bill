"use client";
import { Mail, PhoneCall, Globe, Clock, ShieldCheck, Printer, Glasses } from "lucide-react";
import { PageTitle, Card } from "./ui";

export function Support() {
  return (
    <>
      <PageTitle
        eyebrow="HERE TO HELP"
        title="Opti-X Support"
        description="Direct support for billing assistance, hardware setup, and shop operations."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "18px",
          marginBottom: "26px",
        }}
      >
        <Card style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "rgba(59, 130, 246, 0.12)",
                color: "#2563eb",
              }}
            >
              <Mail size={22} />
            </span>
            <div>
              <strong style={{ fontSize: "16px", display: "block" }}>Email Support</strong>
              <span className="muted" style={{ fontSize: "13px" }}>Direct inbox support</span>
            </div>
          </div>
          <p style={{ fontSize: "17px", fontWeight: 600, margin: "14px 0 6px" }}>
            <a href="mailto:hello@opti-x.in" style={{ color: "var(--accent, #2563eb)", textDecoration: "none" }}>
              hello@opti-x.in
            </a>
          </p>
          <p className="muted" style={{ fontSize: "13px", marginBottom: "16px" }}>
            Send inquiries, invoice questions, and feature requests.
          </p>
          <a
            className="button primary"
            href="mailto:hello@opti-x.in"
            style={{ width: "100%", justifyContent: "center", display: "flex", textDecoration: "none" }}
          >
            Send Email
          </a>
        </Card>

        <Card style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "rgba(34, 197, 94, 0.12)",
                color: "#16a34a",
              }}
            >
              <PhoneCall size={22} />
            </span>
            <div>
              <strong style={{ fontSize: "16px", display: "block" }}>Toll-Free Helpline</strong>
              <span className="muted" style={{ fontSize: "13px" }}>Phone assistance</span>
            </div>
          </div>
          <p style={{ fontSize: "17px", fontWeight: 600, margin: "14px 0 6px" }}>
            <a href="tel:8123649448" style={{ color: "var(--accent, #16a34a)", textDecoration: "none" }}>
              8123649448
            </a>
          </p>
          <p className="muted" style={{ fontSize: "13px", marginBottom: "16px" }}>
            Call toll-free for urgent counter and billing assistance.
          </p>
          <a
            className="button primary"
            href="tel:8123649448"
            style={{ width: "100%", justifyContent: "center", display: "flex", textDecoration: "none" }}
          >
            Call Toll-Free
          </a>
        </Card>

        <Card style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "rgba(168, 85, 247, 0.12)",
                color: "#9333ea",
              }}
            >
              <Globe size={22} />
            </span>
            <div>
              <strong style={{ fontSize: "16px", display: "block" }}>Official Website</strong>
              <span className="muted" style={{ fontSize: "13px" }}>Web portal & documentation</span>
            </div>
          </div>
          <p style={{ fontSize: "17px", fontWeight: 600, margin: "14px 0 6px" }}>
            <a
              href="https://opti-x.in"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent, #9333ea)", textDecoration: "none" }}
            >
              opti-x.in
            </a>
          </p>
          <p className="muted" style={{ fontSize: "13px", marginBottom: "16px" }}>
            Explore user guides, release notes, and documentation.
          </p>
          <a
            className="button secondary"
            href="https://opti-x.in"
            target="_blank"
            rel="noreferrer"
            style={{ width: "100%", justifyContent: "center", display: "flex", textDecoration: "none" }}
          >
            Visit Website
          </a>
        </Card>
      </div>

      <Card style={{ padding: "24px", marginBottom: "26px" }}>
        <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>Support & Assistance Areas</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
            marginTop: "16px",
          }}
        >
          <div style={{ borderLeft: "3px solid var(--accent, #2563eb)", paddingLeft: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Glasses size={18} color="#2563eb" />
              <strong style={{ fontSize: "14px" }}>Counter Billing & GST Invoices</strong>
            </div>
            <p className="muted" style={{ fontSize: "13px", margin: 0 }}>
              Help with HSN codes, inter-state IGST calculation, advance payment recording, and balance dues.
            </p>
          </div>

          <div style={{ borderLeft: "3px solid var(--accent, #16a34a)", paddingLeft: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <Printer size={18} color="#16a34a" />
              <strong style={{ fontSize: "14px" }}>Printer & Document Setup</strong>
            </div>
            <p className="muted" style={{ fontSize: "13px", margin: 0 }}>
              Assistance with 80mm thermal receipt printers, A4 tax invoices, and A5 optical lab job cards.
            </p>
          </div>

          <div style={{ borderLeft: "3px solid var(--accent, #9333ea)", paddingLeft: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <ShieldCheck size={18} color="#9333ea" />
              <strong style={{ fontSize: "14px" }}>Security & Data Retention</strong>
            </div>
            <p className="muted" style={{ fontSize: "13px", margin: 0 }}>
              Guidance on customer data protection, prescription records retention, and backup recovery.
            </p>
          </div>
        </div>
      </Card>

      <Card style={{ padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <Clock size={18} className="muted" />
          <strong style={{ fontSize: "14px" }}>Operating & Support Hours</strong>
        </div>
        <p className="muted" style={{ fontSize: "13px", margin: 0 }}>
          Phone and email support is available Monday through Saturday from 9:30 AM to 7:30 PM IST. You can reach us anytime at{" "}
          <a href="mailto:hello@opti-x.in" style={{ color: "var(--accent, #2563eb)", textDecoration: "none" }}>
            hello@opti-x.in
          </a>
          {" "}or call our toll-free number{" "}
          <a href="tel:8123649448" style={{ color: "var(--accent, #16a34a)", textDecoration: "none" }}>
            8123649448
          </a>
          .
        </p>
      </Card>
    </>
  );
}
