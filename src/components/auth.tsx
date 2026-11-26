"use client";
import { useState } from "react";
import { Glasses } from "lucide-react";
import { Editor } from "./forms";
import { api } from "@/lib/client";
import { BRAND_FOOTER } from "@/lib/i18n";

export function AuthScreen({
  mode = "login",
  configured = true,
}: {
  mode?: "login" | "forgot" | "reset";
  configured?: boolean;
}) {
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <div className="brand" style={{ marginBottom: 24 }}>
          <img
            src="/logo.png"
            alt="Opti-X Billing"
            style={{
              height: 48,
              width: "auto",
              maxWidth: 220,
              objectFit: "contain",
              borderRadius: 10,
              display: "block",
            }}
          />
        </div>
        <div className="auth-mark" aria-hidden />
        <h1>
          A clearer view
          <br />
          of your <span>everyday.</span>
        </h1>
        <p>
          From the first eye test to the final fitting. Keep your counter
          beautifully in focus.
        </p>
        <div className="auth-features">
          <span>01 &nbsp; Prescriptions</span>
          <span>02 &nbsp; Billing</span>
          <span>03 &nbsp; Inventory</span>
        </div>
      </section>
      <section className="auth-form-pane">
        <div className="auth-form">
          <p className="eyebrow">OPTICAL WORKSPACE</p>
          <h1>Good to see you.</h1>
          <p className="muted">Login to access your billing and customer workspace.</p>
          <Editor
            key="login"
            fields={[
              {
                name: "username",
                label: "User",
                type: "text",
                required: true,
              },
              {
                name: "password",
                label: "Password",
                type: "password",
                required: true,
              },
            ]}
            submit="Login"
            onSave={async (data) => {
              await api("login", data);
              window.location.assign("/");
            }}
          />
        </div>
        <footer className="auth-footer">{BRAND_FOOTER}</footer>
      </section>
    </div>
  );
}
