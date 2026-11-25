"use client";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { Button, Field, Input, Stepper } from "./ui";
import { api, today } from "@/lib/client";
import { parseMoney, moneyInput } from "@/lib/money";
import { useToast, useWorkspace } from "./providers";
import { prescriptionSchema } from "@/lib/validation";
import type { Customer, Prescription } from "@/lib/types";
export type FormField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "email"
    | "tel"
    | "password"
    | "date"
    | "textarea"
    | "checkbox"
    | "money"
    | "select";
  options?: string[] | { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  wide?: boolean;
  step?: string;
  min?: number;
  max?: number;
};
export function Editor({
  fields,
  initial = {},
  onSave,
  submit = "Save changes",
}: {
  fields: FormField[];
  initial?: Record<string, unknown>;
  onSave: (v: Record<string, unknown>) => Promise<void>;
  submit?: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Record<string, unknown>>({
    defaultValues: Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.type === "money"
          ? initial[f.name] != null
            ? moneyInput(Number(initial[f.name]))
            : ""
          : (initial[f.name] ?? (f.type === "checkbox" ? false : "")),
      ]),
    ),
  });
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={handleSubmit(async (raw) => {
        try {
          setError("");
          const data = { ...raw };
          for (const f of fields) {
            if (f.type === "number")
              data[f.name] = raw[f.name] === "" ? null : Number(raw[f.name]);
            if (f.type === "money")
              data[f.name] = parseMoney(String(raw[f.name] || "0"));
            if (f.type === "date") data[f.name] = raw[f.name] || null;
          }
          await onSave(data);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unable to save");
        }
      })}
    >
      <div className="form-grid">
        {fields.map((f) =>
          f.type === "checkbox" ? (
            <label className="field-checkbox" key={f.name}>
              <input type="checkbox" {...register(f.name)} />
              <span>
                {f.label}
                {f.hint && <small style={{ display: "block" }}>{f.hint}</small>}
              </span>
            </label>
          ) : (
            <div key={f.name} className={f.wide ? "wide" : ""}>
              <Field label={f.label} hint={f.hint}>
                {f.type === "textarea" ? (
                  <textarea required={f.required} {...register(f.name)} />
                ) : f.type === "select" ? (
                  <select required={f.required} {...register(f.name)}>
                    <option value="">Select</option>
                    {f.options?.map((o) =>
                      typeof o === "string" ? (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ) : (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ),
                    )}
                  </select>
                ) : (
                  <Input
                    {...register(f.name)}
                    type={f.type === "money" ? "text" : f.type || "text"}
                    inputMode={f.type === "money" ? "decimal" : undefined}
                    required={f.required}
                    step={f.step}
                    min={f.min}
                    max={f.max}
                  />
                )}
              </Field>
            </div>
          ),
        )}
      </div>
      {error && (
        <p className="notice error-text" role="alert" style={{ marginTop: 18 }}>
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : submit}
        </Button>
      </div>
    </form>
  );
}
export function getShopFields(requireAddress = true): FormField[] {
  return [
    { name: "name", label: "Shop name", required: true },
    { name: "legal_name", label: "Legal name", required: true },
    { name: "phone", label: "Phone (+91)", type: "tel", required: true },
    { name: "email", label: "Shop email", type: "email", required: true },
    { name: "address", label: "Address", required: requireAddress, wide: true },
    { name: "city", label: "City", required: requireAddress },
    { name: "state", label: "State", required: requireAddress },
    { name: "state_code", label: "GST state code (2 digits)", required: requireAddress },
    { name: "pincode", label: "PIN code", required: requireAddress },
    {
      name: "gst_scheme",
      label: "GST scheme",
      type: "select",
      options: ["regular", "composition", "unregistered"],
      required: true,
    },
    {
      name: "gstin",
      label: "GSTIN",
      hint: "Required for regular and composition shops.",
    },
    {
      name: "invoice_prefix",
      label: "Invoice prefix",
      required: true,
      hint: "1–4 uppercase letters or digits.",
    },
    {
      name: "invoice_recipient_threshold_paise",
      label: "Recipient-address threshold (₹)",
      type: "money",
      required: true,
      hint: "Owner-configured rule; verify the current requirement.",
    },
  ];
}
export const shopFields: FormField[] = getShopFields(true);
export function CustomerForm({
  initial,
  onSaved,
}: {
  initial?: Customer;
  onSaved: (id: string) => void;
}) {
  const { shop } = useWorkspace();
  const toast = useToast();
  const fields: FormField[] = [
    { name: "name", label: "Customer name", required: true },
    {
      name: "phone",
      label: "Mobile number (+91)",
      type: "tel",
      required: true,
    },
    {
      name: "gender",
      label: "Gender",
      type: "select",
      options: ["undisclosed", "male", "female", "other"],
    },
    {
      name: "age_years",
      label: "Age in years",
      type: "number",
      min: 0,
      max: 130,
      hint: "Enter either age or date of birth.",
    },
    { name: "dob", label: "Date of birth", type: "date" },
    { name: "alt_phone", label: "Alternate mobile (+91)", type: "tel" },
    { name: "email", label: "Email", type: "email" },
    { name: "address", label: "Address", wide: true },
    { name: "city", label: "City" },
    {
      name: "state_code",
      label: "State code (e.g. 29 for Karnataka)",
      hint: "2-digit GST state code (e.g. 29 Karnataka, 27 Maharashtra, 07 Delhi, or enter state name)",
    },
    { name: "gstin", label: "GSTIN (for business purchases)" },
    { name: "notes", label: "Notes", type: "textarea", wide: true },
    { name: "guardian_name", label: "Guardian name (under 18)" },
    { name: "guardian_phone", label: "Guardian phone (+91)", type: "tel" },
    {
      name: "guardian_verification",
      label: "Guardian verification method",
      hint: "Record the method and relationship; do not enter identity document numbers.",
      wide: true,
    },
    {
      name: "guardian_consent",
      label:
        "Guardian identity and authority verified; guardian has consented.",
      type: "checkbox",
    },
    {
      name: "consent_given",
      label:
        shop.consent_text ||
        "Publish consent wording in Settings before adding a customer.",
      hint: `Policy version: ${shop.privacy_version || "Not published"}`,
      type: "checkbox",
    },
  ];
  return (
    <Editor
      fields={fields}
      initial={
        initial
          ? { ...initial, consent_given: true }
          : {
              gender: "undisclosed",
              guardian_consent: false,
              consent_given: true,
            }
      }
      submit={initial ? "Update customer" : "Create customer"}
      onSave={async (data) => {
        const result = await api<{ id: string }>("customers", {
          id: initial?.id,
          data,
        });
        toast("Customer saved");
        onSaved(result.id);
      }}
    />
  );
}
export function PrescriptionForm({
  customerId,
  initial,
  onSaved,
}: {
  customerId: string;
  initial?: Prescription;
  onSaved: (id: string) => void;
}) {
  const { profile } = useWorkspace();
  const toast = useToast();
  const [error, setError] = useState("");
  const defaults: Record<string, unknown> = {
    customer_id: customerId,
    test_date: today(),
    examiner_name: profile.full_name,
    source: "in_shop",
    remarks: "",
    valid_until: null,
    bin_pd: null,
    vertex_distance: null,
    pantoscopic_tilt: null,
  };
  const metrics = [
    "sph",
    "cyl",
    "axis",
    "add_power",
    "prism",
    "base",
    "pd_distance",
    "pd_near",
    "seg_height",
    "va_unaided",
    "va_aided",
  ];
  for (const eye of ["od", "os"])
    for (const metric of metrics) defaults[`${eye}_${metric}`] = null;
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<Record<string, unknown>>({
    defaultValues: initial ? { ...initial, customer_id: customerId } : defaults,
  });
  const values = watch();
  return (
    <form
      onSubmit={handleSubmit(async (raw) => {
        try {
          setError("");
          const data: Record<string, unknown> = {
            ...defaults,
            ...values,
            ...raw,
            customer_id: customerId,
            valid_until: raw.valid_until || values.valid_until || null,
          };
          for (const eye of ["od", "os"]) {
            for (const metric of metrics) {
              const k = `${eye}_${metric}`;
              const val = data[k];
              if (val === "" || val === undefined || val === "null") {
                data[k] = null;
              } else if (
                [
                  "sph",
                  "cyl",
                  "axis",
                  "add_power",
                  "prism",
                  "pd_distance",
                  "pd_near",
                  "seg_height",
                ].includes(metric)
              ) {
                data[k] = val !== null && !isNaN(Number(val)) ? Number(val) : null;
              }
            }
            if (data[`${eye}_cyl`] != null && Number(data[`${eye}_cyl`]) !== 0 && data[`${eye}_axis`] == null) {
              data[`${eye}_axis`] = 180;
            }
          }
          if (!data.examiner_name) data.examiner_name = profile.full_name || "Optometrist";
          if (!data.test_date) data.test_date = today();
          const parsed = prescriptionSchema.parse(data);
          const result = await api<{ id: string }>("prescriptions", {
            id: initial?.id,
            data: parsed,
          });
          toast("Prescription saved");
          onSaved(result.id);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Unable to save prescription",
          );
        }
      })}
    >
      <input type="hidden" value={customerId} {...register("customer_id")} />
      {error && (
        <p className="notice error-text" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      <div className="form-grid">
        <Field label="Test date">
          <Input type="date" {...register("test_date")} required />
        </Field>
        <Field label="Examiner">
          <Input {...register("examiner_name")} required />
        </Field>
        <Field label="Source">
          <select {...register("source")}>
            <option value="in_shop">In shop</option>
            <option value="external">External</option>
          </select>
        </Field>
        <Field label="Valid until (optional)">
          <Input type="date" {...register("valid_until")} />
        </Field>
      </div>
      <div className="rx-scroll">
        <table className="rx-table">
          <thead>
            <tr>
              <th>Eye</th>
              {["SPH", "CYL", "AXIS", "ADD"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["od", "os"] as const).map((eye) => (
              <tr key={eye}>
                <td>{eye === "od" ? "OD · Right" : "OS · Left"}</td>
                {["sph", "cyl", "axis", "add_power"].map((metric) => (
                  <td key={metric}>
                    <Stepper
                      label={`${eye.toUpperCase()} ${metric}`}
                      value={values[`${eye}_${metric}`] as number | null}
                      step={metric === "axis" ? 1 : 0.25}
                      min={
                        metric === "axis"
                          ? 1
                          : metric === "add_power"
                            ? 0.25
                            : -30
                      }
                      max={
                        metric === "axis"
                          ? 180
                          : metric === "add_power"
                            ? 4
                            : 30
                      }
                      onChange={(value) => {
                        setValue(`${eye}_${metric}`, value);
                        if (metric === "cyl" && value && !values[`${eye}_axis`]) {
                          setValue(`${eye}_axis`, 180);
                        }
                      }}
                    />
                    {["sph", "cyl"].includes(metric) && (
                      <button
                        type="button"
                        className="text-link"
                        style={{
                          fontSize: 10,
                          background: "none",
                          border: 0,
                          marginTop: 7,
                        }}
                        onClick={() =>
                          setValue(
                            `${eye}_${metric}`,
                            -Number(values[`${eye}_${metric}`] || 0),
                          )
                        }
                      >
                        Flip + / −
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(["od", "os"] as const).some(
        (e) =>
          Math.abs(Number(values[`${e}_sph`])) > 10 ||
          Math.abs(Number(values[`${e}_cyl`])) > 6,
      ) && (
        <p className="notice warning">
          Unusual power entered. Please verify against the measured
          prescription.
        </p>
      )}
      <details style={{ margin: "16px 0" }}>
        <summary>PD, prism, visual acuity and fitting measurements</summary>
        <div className="form-grid" style={{ marginTop: 18 }}>
          {(["od", "os"] as const).flatMap((eye) =>
            metrics.slice(4).map((metric) => {
              const text = ["base", "va_unaided", "va_aided"].includes(metric);
              return (
                <Field
                  key={`${eye}_${metric}`}
                  label={`${eye.toUpperCase()} · ${metric.replaceAll("_", " ")}`}
                >
                  <Input
                    type={text ? "text" : "number"}
                    step="0.25"
                    value={String(values[`${eye}_${metric}`] ?? "")}
                    onChange={(e) =>
                      setValue(
                        `${eye}_${metric}`,
                        e.target.value === ""
                          ? null
                          : text
                            ? e.target.value
                            : Number(e.target.value),
                      )
                    }
                  />
                </Field>
              );
            }),
          )}
          {["bin_pd", "vertex_distance", "pantoscopic_tilt"].map((metric) => (
            <Field key={metric} label={metric.replaceAll("_", " ")}>
              <Input
                type="number"
                step="0.25"
                value={String(values[metric] ?? "")}
                onChange={(e) =>
                  setValue(
                    metric,
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </Field>
          ))}
        </div>
      </details>
      <Field label="Remarks">
        <textarea {...register("remarks")} />
      </Field>
      {error && (
        <p className="notice error-text" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <Button disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save prescription"}
        </Button>
      </div>
    </form>
  );
}
