"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Trash2, ArrowRight, Check, Printer } from "lucide-react";
import { api, displayDate, today } from "@/lib/client";
import {
  calculateInvoice,
  formatMoney,
  parseMoney,
  percentDiscount,
} from "@/lib/money";
import { draftSchema, itemSchema } from "@/lib/validation";
import type {
  Customer,
  Prescription,
  TaxCategory,
  Frame,
  Lens,
  OrderItem,
  Invoice,
  Order,
} from "@/lib/types";
import { useWorkspace, useToast } from "./providers";
import {
  PageTitle,
  Card,
  Button,
  SearchInput,
  BottomSheet,
  Field,
  Input,
  EmptyState,
  Skeleton,
  ErrorState,
  Badge,
} from "./ui";
import {
  CustomerForm,
  PrescriptionForm,
  Editor,
  type FormField,
} from "./forms";
import { RxTable } from "./details";
import { ImageUploader } from "./image-uploader";
import { DynamicItemForm } from "./item-form";
type BillValues = {
  customer_id: string;
  prescription_id: string | null;
  place_of_supply_state_code: string;
  promised_date: string;
  notes: string;
  items: OrderItem[];
  discountMode: "flat" | "percent";
  discount: string;
};
type Split = {
  amount_paise: number;
  mode: string;
  reference_no: string;
  idempotency_key: string;
};
export function BillWizard() {
  const { shop, profile } = useWorkspace();
  const toast = useToast();
  const params = useSearchParams();
  const [id] = useState(() => params.get("draft") || crypto.randomUUID());
  const [step, setStep] = useState(0),
    [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null),
    [customerOpen, setCustomerOpen] = useState(false),
    [rxOpen, setRxOpen] = useState(false),
    [showNewRx, setShowNewRx] = useState(false),
    [itemOpen, setItemOpen] = useState(false),
    [splitOpen, setSplitOpen] = useState(false),
    [hasLensPhoto, setHasLensPhoto] = useState(false),
    [initialItemTab, setInitialItemTab] = useState("Frame + Lens");
  const [saving, setSaving] = useState("Not saved"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [orderId, setOrderId] = useState<string | null>(null),
    [splits, setSplits] = useState<Split[]>([]),
    [ready, setReady] = useState(!params.get("draft"));
  const [frameId, setFrameId] = useState("");
  const version = useRef(0),
    saveQueue = useRef<Promise<void>>(Promise.resolve()),
    finalising = useRef(false),
    loaded = useRef(false),
    lastSaved = useRef(""),
    key = useRef(crypto.randomUUID());
  const { register, watch, setValue, getValues } = useForm<BillValues>({
    defaultValues: {
      customer_id: params.get("customer") || "",
      prescription_id: null,
      place_of_supply_state_code: shop.state_code,
      promised_date: "",
      notes: "",
      items: [],
      discountMode: "flat",
      discount: "0",
    },
  });
  const values = watch();
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  const customerSearch = useQuery({
    queryKey: ["bill-customer-search", debounced],
    queryFn: () =>
      api<{ rows: Customer[] }>(`customers?q=${encodeURIComponent(debounced)}`),
    enabled: debounced.length >= 3,
  });
  const prescriptions = useQuery({
    queryKey: ["bill-prescriptions", values.customer_id],
    queryFn: () =>
      api<{ rows: Prescription[] }>(
        `prescriptions?customer=${values.customer_id}`,
      ),
    enabled: !!values.customer_id,
  });
  const taxes = useQuery({
    queryKey: ["bill-taxes"],
    queryFn: () => api<{ rows: TaxCategory[] }>("active-taxes"),
  });
  const frames = useQuery({
    queryKey: ["bill-frames"],
    queryFn: () => api<{ rows: Frame[] }>("frames"),
  });
  const lenses = useQuery({
    queryKey: ["bill-lenses"],
    queryFn: () => api<{ rows: Lens[] }>("lenses"),
  });
  const currentTaxes = (taxes.data?.rows || [])
    .filter((t) => t.is_active && t.effective_from <= today())
    .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
    .filter((t, i, all) => all.findIndex((x) => x.name === t.name) === i);
  const selectedFrame = frames.data?.rows.find((f) => f.id === frameId);
  const selectedRx = prescriptions.data?.rows.find(
    (r) => r.id === values.prescription_id,
  );
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    if (params.get("draft")) {
      void api<{
        invoice: Invoice;
        order: Order;
        items: OrderItem[];
        customer: Customer;
      }>(`draft?id=${id}`)
        .then((d) => {
          version.current = d.invoice.draft_version;
          setCustomer(d.customer);
          setOrderId(d.order.id);
          setValue("customer_id", d.customer.id);
          setValue("prescription_id", d.order.prescription_id);
          setValue(
            "place_of_supply_state_code",
            d.invoice.place_of_supply_state_code,
          );
          setValue("promised_date", d.order.promised_date || "");
          setValue("notes", d.order.notes || "");
          setValue("items", d.items);
          setValue("discount", String(d.invoice.overall_discount_paise / 100));
          setSplits(d.invoice.draft_payments || []);
          setReady(true);
          setSaving("Saved draft");
        })
        .catch((e) => setError(e.message));
    } else if (params.get("customer"))
      void api<{ rows: Customer[] }>(`customers?id=${params.get("customer")}`)
        .then((d) => setCustomer(d.rows[0] || null))
        .catch((e) => setError(e.message));
  }, [id, params, setValue]);
  const base = values.items.reduce(
    (n, l) => n + l.qty * l.unit_price_paise - l.discount_paise,
    0,
  );
  let discount = 0,
    calcError = "";
  try {
    discount =
      values.discountMode === "percent"
        ? percentDiscount(base, parseMoney(values.discount || "0"))
        : parseMoney(values.discount || "0");
  } catch (e) {
    calcError = e instanceof Error ? e.message : "Invalid discount";
  }
  let totals: ReturnType<typeof calculateInvoice> | null = null;
  try {
    totals = calculateInvoice(
      values.items.map((l) => ({
        ...l,
        gst_rate_bp:
          currentTaxes.find(
            (t) =>
              t.id === l.tax_category_id ||
              t.name ===
                taxes.data?.rows.find((o) => o.id === l.tax_category_id)?.name,
          )?.gst_rate_bp || 0,
      })),
      discount,
      values.place_of_supply_state_code !== shop.state_code,
      shop.gst_scheme === "regular",
    );
  } catch (e) {
    calcError = e instanceof Error ? e.message : "Review values";
  }
  const stateRef = useRef({ values, discount, splits });
  stateRef.current = { values, discount, splits };
  const save = useCallback(async () => {
    const operation = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        const current = stateRef.current;
        const raw = {
          ...current.values,
          id,
          expected_version: Number(version.current) || 0,
          overall_discount_paise: current.discount,
          payments: current.splits,
          promised_date: current.values.promised_date || null,
        };
        const validated = draftSchema.parse(raw);
        const payload = JSON.stringify({ ...validated, expected_version: 0 });
        if (payload === lastSaved.current && (version.current || 0) > 0) return;
        setSaving("Saving…");
        const result = await api<{
          id: string;
          order_id: string;
          version: number;
        }>("draft", validated);
        version.current = Number(result?.version) || 0;
        setOrderId(result.order_id);
        lastSaved.current = payload;
        setSaving("All changes saved");
        history.replaceState(null, "", `/new-bill?draft=${id}`);
      });
    saveQueue.current = operation;
    return operation;
  }, [id]);
  useEffect(() => {
    if (!ready || !values.customer_id || finalising.current || calcError)
      return;
    const timer = setTimeout(
      () =>
        void save().catch((e) => {
          setSaving("Save failed — retry");
          setError(e.message);
        }),
      900,
    );
    return () => clearTimeout(timer);
  }, [
    values.customer_id,
    values.prescription_id,
    values.items,
    values.place_of_supply_state_code,
    values.promised_date,
    values.notes,
    values.discount,
    values.discountMode,
    ready,
    calcError,
    save,
    splits,
  ]);
  async function selectCustomer(c: Customer) {
    setCustomer(c);
    setValue("customer_id", c.id);
    setValue("prescription_id", null);
    setValue("place_of_supply_state_code", c.state_code || shop.state_code);
    setTimeout(() => void save(), 50);
  }
  async function finalise() {
    if (finalising.current) return;
    try {
      setError("");
      finalising.current = true;
      setBusy(true);
      if (calcError) throw new Error(calcError);
      if (!totals || !values.items.length)
        throw new Error("Add at least one item");
      if (splits.reduce((n, p) => n + p.amount_paise, 0) > totals.grand_total)
        throw new Error("Payments exceed total");
      await save();
      await api("finalise", { id, key: key.current, payments: splits });
      window.location.assign(`/print/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to finalise");
      finalising.current = false;
      setBusy(false);
    }
  }
  if (profile.role === "optometrist")
    return (
      <EmptyState
        title="Prescription access"
        description="Your role has access to customer prescriptions."
        href="/customers"
        action="Open customers"
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="THE COUNTER, SIMPLIFIED"
        title="A new pair. A new perspective."
        description="Customer to printed bill, with every detail in place."
        action={<Badge>{saving}</Badge>}
      />
      <div className="wizard-steps">
        {["Customer", "Prescription", "Items", "Review & pay"].map(
          (label, i) => (
            <div
              className={`wizard-step ${step === i ? "current" : step > i ? "done" : ""}`}
              key={label}
            >
              <span>{step > i ? <Check size={15} /> : i + 1}</span>
              {label}
            </div>
          ),
        )}
      </div>
      {error && (
        <div
          className="notice error-text"
          role="alert"
          style={{ marginBottom: 20 }}
        >
          {error}
        </div>
      )}
      {!ready ? (
        <Skeleton />
      ) : (
        <div className="wizard-layout">
          <Card>
            <div className="wizard-body">
              {step === 0 && (
                <>
                  <h2>Who are we helping today?</h2>
                  <p className="section-note">
                    Start with a mobile number. Existing records are one tap
                    away.
                  </p>
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    label="Search mobile number or name"
                  />
                  {customerSearch.isFetching && <Skeleton rows={1} />}{" "}
                  {customerSearch.error && (
                    <ErrorState
                      error={customerSearch.error}
                      retry={() => void customerSearch.refetch()}
                    />
                  )}
                  <div style={{ marginTop: 20 }}>
                    {customerSearch.data?.rows.map((c) => (
                      <button
                        key={c.id}
                        className="list-choice"
                        aria-pressed={values.customer_id === c.id}
                        onClick={() => void selectCustomer(c)}
                      >
                        <span>
                          <strong>{c.name}</strong>
                          <small>
                            {c.phone} · First visit {displayDate(c.created_at)}
                          </small>
                        </span>
                        <ArrowRight size={17} />
                      </button>
                    ))}
                  </div>
                  {customer && (
                    <div className="notice">
                      <div className="row between">
                        <strong>{customer.name}</strong>
                        <Badge>Selected</Badge>
                      </div>
                      <p className="muted">{customer.phone}</p>
                      <small>
                        {prescriptions.data?.rows[0]
                          ? `Latest eye test: ${displayDate(prescriptions.data.rows[0].test_date)}`
                          : "No prescription on record yet."}
                      </small>
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    style={{ marginTop: 20 }}
                    onClick={() => setCustomerOpen(true)}
                  >
                    <Plus size={16} />
                    Create a new customer
                  </Button>
                </>
              )}
              {step === 1 && (
                <>
                  <div className="card-heading">
                    <div>
                      <h2>Prescription</h2>
                      <p className="section-note">
                        Enter an eye test, select a past prescription, or skip for non-prescription purchases.
                      </p>
                    </div>
                  </div>

                  <div
                    className="notice"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                      marginBottom: 20,
                    }}
                  >
                    <div>
                      <strong>Non-prescription purchase?</strong>
                      <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                        Frames without power, plain sunglasses, contact lens solutions, or accessories.
                      </p>
                    </div>
                    <Button
                      variant={values.prescription_id ? "ghost" : "secondary"}
                      onClick={async () => {
                        setValue("prescription_id", null);
                        await save();
                        setStep(2);
                      }}
                    >
                      Continue without prescription →
                    </Button>
                  </div>

                  {selectedRx && (
                    <div
                      className="notice"
                      style={{
                        marginBottom: 20,
                        borderLeft: "4px solid var(--accent, #b49300)",
                      }}
                    >
                      <div className="row between">
                        <div>
                          <div className="row" style={{ gap: 8, alignItems: "center" }}>
                            <strong>Selected Prescription</strong>
                            <Badge>Attached to this bill</Badge>
                          </div>
                          <small style={{ display: "block", marginTop: 4 }}>
                            {displayDate(selectedRx.test_date)} · {selectedRx.examiner_name} · {selectedRx.source.replace("_", " ")}
                          </small>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => setValue("prescription_id", null)}
                        >
                          Remove prescription
                        </Button>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <RxTable rx={selectedRx} />
                      </div>
                    </div>
                  )}

                  {prescriptions.isPending ? (
                    <Skeleton rows={2} />
                  ) : prescriptions.error ? (
                    <ErrorState
                      error={prescriptions.error}
                      retry={() => void prescriptions.refetch()}
                    />
                  ) : (
                    <>
                      {!!prescriptions.data?.rows.length && (
                        <div style={{ marginBottom: 24 }}>
                          <div className="row between" style={{ marginBottom: 12 }}>
                            <strong style={{ fontSize: 14 }}>
                              Previous eye tests on record ({prescriptions.data.rows.length})
                            </strong>
                            <Button
                              variant="secondary"
                              onClick={() => setShowNewRx((prev) => !prev)}
                            >
                              <Plus size={15} />
                              {showNewRx ? "Hide eye test form" : "Enter a new eye test"}
                            </Button>
                          </div>
                          {prescriptions.data.rows.map((r) => (
                            <div className="bill-item" key={r.id}>
                              <button
                                className="list-choice"
                                style={{ margin: 0, border: 0, padding: 0 }}
                                aria-pressed={values.prescription_id === r.id}
                                onClick={() => {
                                  setValue("prescription_id", r.id);
                                  setShowNewRx(false);
                                }}
                              >
                                <span>
                                  <strong>{displayDate(r.test_date)}</strong>
                                  <small>
                                    {r.examiner_name} · {r.source.replace("_", " ")}
                                  </small>
                                </span>
                                {values.prescription_id === r.id ? (
                                  <Check size={18} />
                                ) : (
                                  <span>Use this</span>
                                )}
                              </button>
                              <RxTable rx={r} />
                            </div>
                          ))}
                        </div>
                      )}

                      {(!prescriptions.data?.rows.length || showNewRx) && values.customer_id && (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>
                              {prescriptions.data?.rows.length ? "New Eye Test" : "Enter Eye Test & Prescription"}
                            </h3>
                            <p className="section-note" style={{ margin: "4px 0 0" }}>
                              Enter measured SPH, CYL, AXIS, and ADD powers below.
                            </p>
                          </div>
                          <PrescriptionForm
                            customerId={values.customer_id}
                            onSaved={async (rxId) => {
                              setValue("prescription_id", rxId);
                              setShowNewRx(false);
                              await prescriptions.refetch();
                              toast("Prescription saved & attached to bill");
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              {step === 2 && (
                <>
                  <div className="card-heading">
                    <div>
                      <h2>Build the perfect pair.</h2>
                      <p className="section-note">
                        All prices are exclusive of tax.
                      </p>
                    </div>
                    <Button
                      onClick={() => setItemOpen(true)}
                      disabled={!currentTaxes.length}
                    >
                      <Plus size={16} />
                      Add item
                    </Button>
                  </div>
                  {taxes.error && (
                    <ErrorState
                      error={taxes.error}
                      retry={() => void taxes.refetch()}
                    />
                  )}{" "}
                  {!currentTaxes.length && (
                    <div className="notice warning">
                      No active tax categories. The owner must add current HSN
                      codes and rates in Settings, including zero-rate
                      categories when applicable.
                    </div>
                  )}
                  {!values.items.length ? (
                    <EmptyState
                      title="Your bill starts with an item."
                      description="Add frames, lenses or extras. Tax is calculated from your shop’s settings."
                      action="Add frame or lens item"
                      onAction={() => {
                        setInitialItemTab(hasLensPhoto ? "Lens only" : "Frame + Lens");
                        setItemOpen(true);
                      }}
                    />
                  ) : (
                    values.items.map((l, index) => (
                      <div className="bill-item" key={index}>
                        <div className="row between">
                          <div>
                            <strong>{l.description}</strong>
                            <small>
                              {l.qty} {l.unit} ·{" "}
                              {formatMoney(l.unit_price_paise)} each
                            </small>
                            <small>
                              {[
                                l.frame_model_no,
                                l.lens_brand,
                                l.lens_type,
                                l.coatings,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </small>
                          </div>
                          <div className="row">
                            <span className="item-price">
                              {formatMoney(
                                l.qty * l.unit_price_paise - l.discount_paise,
                              )}
                            </span>
                            <Button
                              variant="ghost"
                              aria-label={`Remove ${l.description}`}
                              onClick={() =>
                                setValue(
                                  "items",
                                  values.items.filter((_, i) => i !== index),
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div style={{ margin: "20px 0" }}>
                    <ImageUploader
                      orderId={orderId}
                      onPhotoChange={(url) => setHasLensPhoto(Boolean(url))}
                    />
                    {hasLensPhoto && !values.items.length && (
                      <div
                        className="notice"
                        style={{
                          marginTop: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        <div>
                          <strong>Lens packet photo uploaded!</strong>
                          <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                            Add your lens price to calculate bill totals and continue.
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setInitialItemTab("Lens only");
                            setItemOpen(true);
                          }}
                        >
                          <Plus size={14} />
                          Add lens price
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
              {step === 3 && (
                <>
                  <h2>Ready when you are.</h2>
                  <p className="section-note">
                    Check the details, record an advance and finalise the bill.
                  </p>
                  <div className="notice">
                    <strong>{customer?.name}</strong>
                    <p className="muted">
                      {customer?.phone} · {values.items.length} line items
                    </p>
                    <small>
                      {values.prescription_id
                        ? "Prescription attached"
                        : "No prescription attached"}
                    </small>
                  </div>
                  <div className="form-grid" style={{ margin: "22px 0" }}>
                    <Field label="Place of supply state code">
                      <Input
                        {...register("place_of_supply_state_code")}
                        maxLength={2}
                      />
                    </Field>
                    <Field label="Promised delivery date">
                      <Input type="date" {...register("promised_date")} />
                    </Field>
                  </div>
                  <Field label="Order notes">
                    <textarea {...register("notes")} />
                  </Field>
                  <div className="card-heading" style={{ marginTop: 24 }}>
                    <h3>Payment now</h3>
                    <Button
                      variant="secondary"
                      onClick={() => setSplitOpen(true)}
                    >
                      <Plus size={14} />
                      Add payment
                    </Button>
                  </div>
                  {!splits.length && (
                    <p className="muted">
                      No payment entered. The full amount will remain due.
                    </p>
                  )}
                  {splits.map((p, i) => (
                    <div className="summary-line" key={p.idempotency_key}>
                      <span>
                        {p.mode} · {p.reference_no || "No reference"}
                      </span>
                      <span>
                        {formatMoney(p.amount_paise)}{" "}
                        <Button
                          variant="ghost"
                          aria-label="Remove payment"
                          onClick={() =>
                            setSplits(splits.filter((_, n) => n !== i))
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </span>
                    </div>
                  ))}
                  <p className="notice" style={{ marginTop: 20 }}>
                    Finalising assigns the next invoice number and freezes the
                    bill. Later corrections use cancellation or credit notes.
                  </p>
                </>
              )}
            </div>
            <div className="wizard-controls">
              <Button
                variant="ghost"
                disabled={step === 0 || busy}
                onClick={() => setStep(step - 1)}
              >
                Back
              </Button>
              <div className="row">
                <Button
                  variant="secondary"
                  disabled={!values.customer_id || busy}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      await save();
                      toast("Draft saved");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Unable to save draft");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Save draft
                </Button>
                {step < 3 ? (
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      if (step === 0 && !values.customer_id) {
                        toast("Please select or add a customer to continue.");
                        return;
                      }
                      if (step === 2 && !values.items.length) {
                        toast(
                          "Please add at least one item (frame or lens) with price to continue.",
                        );
                        setInitialItemTab(
                          hasLensPhoto ? "Lens only" : "Frame + Lens",
                        );
                        setItemOpen(true);
                        return;
                      }
                      setBusy(true);
                      try {
                        await save();
                        setStep(step + 1);
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Failed to save draft",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Save & continue
                    <ArrowRight size={15} />
                  </Button>
                ) : (
                  <Button
                    disabled={busy || !!calcError}
                    onClick={() => void finalise()}
                  >
                    <Printer size={16} />
                    {busy ? "Finalising…" : "Finalise & print"}
                  </Button>
                )}
              </div>
            </div>
          </Card>
          <Card className="sticky-summary">
            <p className="eyebrow">AT A GLANCE</p>
            <h2>Your bill</h2>
            <p className="section-note">
              {customer?.name || "Choose a customer to start."}
            </p>
            {calcError ? (
              <p className="error-text">{calcError}</p>
            ) : (
              totals && (
                <>
                  {[
                    ["Subtotal", totals.subtotal],
                    ...(totals.discount_total > 0
                      ? [["Discount", -totals.discount_total]]
                      : []),
                    ["Taxable", totals.taxable_total],
                    ...(shop.gst_scheme === "regular"
                      ? values.place_of_supply_state_code === shop.state_code
                        ? [
                            ["CGST", totals.cgst],
                            ["SGST", totals.sgst],
                          ]
                        : [["IGST", totals.igst]]
                      : []),
                    ["Round off", totals.round_off],
                  ].map(([label, amount]) => (
                    <div className="summary-line" key={label}>
                      <span>{label}</span>
                      <span>{formatMoney(Number(amount))}</span>
                    </div>
                  ))}
                  <div className="summary-line summary-total">
                    <span>Total</span>
                    <span>{formatMoney(totals.grand_total)}</span>
                  </div>
                  <div className="summary-line">
                    <span>Paying now</span>
                    <span>
                      {formatMoney(
                        splits.reduce((n, p) => n + p.amount_paise, 0),
                      )}
                    </span>
                  </div>
                  <div className="summary-line">
                    <strong>Balance</strong>
                    <strong>
                      {formatMoney(
                        totals.grand_total -
                          splits.reduce((n, p) => n + p.amount_paise, 0),
                      )}
                    </strong>
                  </div>
                </>
              )
            )}
            <p className="section-note">
              {shop.gst_scheme === "regular"
                ? values.place_of_supply_state_code === shop.state_code
                  ? "Intra-state supply · CGST + SGST"
                  : "Inter-state supply · IGST"
                : "Bill of Supply · No GST charged"}
            </p>
            <small>Totals are verified again when you finalise.</small>
          </Card>
        </div>
      )}
      <BottomSheet
        open={customerOpen}
        onClose={() => setCustomerOpen(false)}
        title="Create customer"
      >
        <CustomerForm
          onSaved={async (customerId) => {
            const r = await api<{ rows: Customer[] }>(
              `customers?id=${customerId}`,
            );
            await selectCustomer(r.rows[0]);
            setCustomerOpen(false);
          }}
        />
      </BottomSheet>
      <BottomSheet
        open={rxOpen}
        onClose={() => setRxOpen(false)}
        title="New prescription"
      >
        {values.customer_id && (
          <PrescriptionForm
            customerId={values.customer_id}
            onSaved={async (rxId) => {
              setValue("prescription_id", rxId);
              setRxOpen(false);
              await prescriptions.refetch();
            }}
          />
        )}
      </BottomSheet>
      <BottomSheet
        open={itemOpen}
        onClose={() => setItemOpen(false)}
        title="Add an item"
      >
        <DynamicItemForm
          frames={frames.data?.rows || []}
          lenses={lenses.data?.rows || []}
          taxes={currentTaxes}
          initialTab={initialItemTab}
          onAdd={(newItems) => {
            setValue("items", [...getValues("items"), ...newItems]);
            setItemOpen(false);
          }}
          onClose={() => setItemOpen(false)}
        />
      </BottomSheet>
      <BottomSheet
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        title="Add payment"
      >
        <Editor
          fields={[
            {
              name: "amount_paise",
              label: "Amount (₹)",
              type: "money",
              required: true,
            },
            {
              name: "mode",
              label: "Mode",
              type: "select",
              options: ["cash", "upi", "card", "bank", "other"],
              required: true,
            },
            { name: "reference_no", label: "Reference" },
          ]}
          initial={{
            mode: "cash",
            amount_paise: Math.max(
              0,
              (totals?.grand_total || 0) -
                splits.reduce((n, p) => n + p.amount_paise, 0),
            ),
          }}
          submit="Add payment"
          onSave={async (data) => {
            if (Number(data.amount_paise) <= 0)
              throw new Error("Payment must be positive");
            setSplits([
              ...splits,
              {
                amount_paise: Number(data.amount_paise),
                mode: String(data.mode),
                reference_no: String(data.reference_no || ""),
                idempotency_key: crypto.randomUUID(),
              },
            ]);
            setSplitOpen(false);
          }}
        />
      </BottomSheet>
    </>
  );
}
