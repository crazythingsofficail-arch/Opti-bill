"use client";
import {
  useState,
  useId,
  useRef,
  useEffect,
  type ReactNode,
  type CSSProperties,
  type InputHTMLAttributes,
  type ButtonHTMLAttributes,
} from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Search,
  X,
  Plus,
  Minus,
  AlertCircle,
  Inbox,
  ArrowUpDown,
} from "lucide-react";
export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <small className="error-text">{error}</small>}
    </label>
  );
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className || ""}`} />;
}
export const DatePicker = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <Input {...props} type="date" />
);
export function PhoneInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="tel"
      placeholder="+91"
      autoComplete="tel"
    />
  );
}
export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return <section className={`card ${className}`} style={style}>{children}</section>;
}
export function StatCard({
  label,
  value,
  note,
  signature = false,
}: {
  label: string;
  value: string;
  note: string;
  signature?: boolean;
}) {
  return (
    <section className={`stat-card ${signature ? "signature" : ""}`}>
      <div className="stat-body">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
      <ArrowUpRight size={20} className="stat-arrow" aria-hidden />
    </section>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function EmptyState({
  title,
  description,
  href,
  action,
  onAction,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={26} strokeWidth={1.4} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {href && (
        <Link href={href} className="button primary">
          {action || "Get started"}
          <ArrowUpRight size={16} />
        </Link>
      )}
      {onAction && !href && (
        <div style={{ marginTop: 12 }}>
          <Button onClick={onAction}>
            <Plus size={16} />
            {action || "Add item"}
          </Button>
        </div>
      )}
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={22} />
      <p>{error instanceof Error ? error.message : "Unable to load records"}</p>
      <Button variant="secondary" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-label="Loading" aria-busy="true" className="skeleton-stack">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={id}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-heading">
        <h2 id={id}>{title}</h2>
        <Button aria-label="Close" variant="ghost" onClick={onClose}>
          <X size={20} />
        </Button>
      </div>
      <div className="sheet-content">{children}</div>
    </dialog>
  );
}
export function ConfirmDialog({
  open,
  title,
  children,
  onClose,
  onConfirm,
  busy = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <BottomSheet open={open} title={title} onClose={onClose}>
      {children}
      <div className="actions">
        <Button variant="secondary" onClick={onClose}>
          Back
        </Button>
        <Button variant="danger" disabled={busy} onClick={onConfirm}>
          {busy ? "Working…" : "Confirm"}
        </Button>
      </div>
    </BottomSheet>
  );
}
export function Stepper({
  value,
  onChange,
  min = -30,
  max = 30,
  step = 0.25,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  return (
    <div className="numeric-stepper">
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={() => onChange(Math.max(min, (value || 0) - step))}
      >
        <Minus size={12} />
      </button>
      <input
        aria-label={label}
        inputMode="decimal"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={() => onChange(Math.min(max, (value || 0) + step))}
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
export function SegmentedControl({
  values,
  value,
  onChange,
}: {
  values: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="segments" role="group">
      {values.map((v) => (
        <button
          type="button"
          key={v}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
export function Combobox({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <Field label={label}>
      <Input
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={id}>
        {values.map((v) => (
          <option key={v.id} value={v.label} />
        ))}
      </datalist>
    </Field>
  );
}
export function SearchInput({
  value,
  onChange,
  label = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="search-input">
      <Search size={18} />
      <Input
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty = "No records yet",
}: {
  rows: T[];
  columns: {
    key: string;
    label: string;
    render: (row: T) => ReactNode;
    sort?: (row: T) => string | number;
  }[];
  rowKey: (r: T) => string;
  empty?: string;
}) {
  const [sort, setSort] = useState<{ key: string; direction: number } | null>(
    null,
  );
  const column = columns.find((c) => c.key === sort?.key);
  const sorted = [...rows];
  if (column?.sort && sort)
    sorted.sort((a, b) => {
      const av = column.sort!(a),
        bv = column.sort!(b);
      return (av < bv ? -1 : av > bv ? 1 : 0) * sort.direction;
    });
  if (!rows.length)
    return (
      <EmptyState
        title={empty}
        description="Your saved records will appear here."
      />
    );
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                aria-sort={
                  sort?.key === c.key
                    ? sort.direction === 1
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                {c.sort ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSort({
                        key: c.key,
                        direction: sort?.key === c.key ? -sort.direction : 1,
                      })
                    }
                  >
                    {c.label}
                    <ArrowUpDown size={12} />
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.label}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Pager({
  count,
  page,
  onPage,
}: {
  count: number;
  page: number;
  onPage: (n: number) => void;
}) {
  return (
    <div className="pager">
      <small>
        {count} records · Page {page} of {Math.max(1, Math.ceil(count / 50))}
      </small>
      <div>
        <Button
          variant="ghost"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="ghost"
          disabled={page * 50 >= count}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
