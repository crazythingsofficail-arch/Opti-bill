"use client";
import { Editor, shopFields } from "./forms";
import { api } from "@/lib/client";
import { Card, PageTitle } from "./ui";
import { BRAND_FOOTER } from "@/lib/i18n";
export function Setup() {
  return (
    <main style={{ maxWidth: 840 }}>
      <PageTitle
        eyebrow="WELCOME TO OPTI-X"
        title="Make it your workspace."
        description="Start with your shop’s real details. Tax categories and policies come next."
      />
      <Card>
        <Editor
          fields={[
            { name: "full_name", label: "Your full name", required: true },
            ...shopFields,
          ]}
          submit="Create shop"
          onSave={async (data) => {
            await api("setup", data);
            window.location.assign("/settings");
          }}
        />
      </Card>
      <footer className="auth-footer">{BRAND_FOOTER}</footer>
    </main>
  );
}
