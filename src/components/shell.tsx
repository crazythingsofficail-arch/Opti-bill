"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Users,
  Plus,
  Package,
  Ellipsis,
  FileText,
  Wallet,
  Glasses,
  ChartNoAxesCombined,
  Settings,
  Search,
  Sun,
  Moon,
  PanelLeftClose,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
  Command,
} from "lucide-react";
import { useWorkspace } from "./providers";
import { BottomSheet, Button, SearchInput, ErrorState } from "./ui";
import { api } from "@/lib/client";
import { BRAND_FOOTER } from "@/lib/i18n";
import type { Customer, Invoice } from "@/lib/types";
const navigation = [
  ["/", "Overview", Home],
  ["/customers", "Customers", Users],
  ["/new-bill", "New Bill", Plus],
  ["/inventory", "Inventory", Glasses],
  ["/reports", "Reports", ChartNoAxesCombined],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const { profile, shop } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [dark, setDark] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("opti-theme");
    const value = stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(value);
    document.documentElement.dataset.theme = value ? "dark" : "light";
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearch(true);
        return;
      }
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if (e.key === "/") {
        e.preventDefault();
        setSearch(true);
      }
      if (e.key.toLowerCase() === "n" && profile.role !== "optometrist")
        router.push("/new-bill");
    };
    window.addEventListener("keydown", handle);
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("keydown", handle);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [router, profile.role]);
  const customers = useQuery({
    queryKey: ["command-customers", debounced],
    queryFn: () =>
      api<{ rows: Customer[] }>(`customers?q=${encodeURIComponent(debounced)}`),
    enabled: search && debounced.length > 1,
  });
  function theme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("opti-theme", next ? "dark" : "light");
  }
  const nav = navigation.filter(
    ([href]) =>
      profile.role === "owner" ||
      (profile.role === "optometrist"
        ? href === "/customers"
        : !["/settings", "/reports"].includes(href)),
  );
  return (
    <div className={`workspace ${collapsed ? "collapsed" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <Glasses size={26} />
          </span>
          <span>
            opti<span className="brand-x">-x</span>
            <small>BILLING</small>
          </span>
        </Link>
        <p className="sidebar-label">WORKSPACE</p>
        <nav>
          {nav.map(([href, label, Icon]) => (
            <Link
              title={label}
              aria-current={pathname === href ? "page" : undefined}
              key={href}
              href={href}
              className={`nav-item ${pathname === href || (href !== "/" && pathname.startsWith(href + "/")) ? "active" : ""}`}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/support" className="help-card">
            <span className="help-dot" />
            <span>
              Here to help<small>Opti-X support</small>
            </span>
            <ArrowUpRight size={18} />
          </Link>
          <button
            className="profile"
            onClick={() =>
              void api("logout", {}).then(() =>
                window.location.assign("/login"),
              )
            }
          >
            <span className="avatar">
              {profile.full_name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              {profile.full_name}
              <small>{profile.role}</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              variant="ghost"
              aria-label="Collapse sidebar"
              onClick={() => setCollapsed(!collapsed)}
            >
              <PanelLeftClose size={20} />
            </Button>
            <span className="shop-name">{shop.name}</span>
          </div>
          <div className="topbar-right">
            <button className="command-trigger" onClick={() => setSearch(true)}>
              <Search size={16} />
              <span>Search anything</span>
              <kbd>⌘ K</kbd>
            </button>
            <Button
              variant="ghost"
              aria-label={dark ? "Use light mode" : "Use dark mode"}
              onClick={theme}
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
            <span className="secure-label">
              <ShieldCheck size={15} />
              Private workspace
            </span>
          </div>
        </header>
        {offline && (
          <div className="offline-banner" role="status">
            You’re offline. Viewing only — reconnect to save changes.
          </div>
        )}
        <main id="main">{children}</main>
        <footer className="app-footer">
          {BRAND_FOOTER}
          <span>
            <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/terms">Terms</Link>
          </span>
        </footer>
      </div>
      <nav className="bottom-tabs" aria-label="Mobile navigation">
        {[
          ["/", "Home", Home],
          ["/customers", "Customers", Users],
          ["/new-bill", "New bill", Plus],
          ["/inventory", "Inventory", Glasses],
        ].map(([href, label, Icon]) => {
          const I = Icon as typeof Home;
          return (
            <Link
              key={String(href)}
              href={String(href)}
              className={
                href === "/new-bill"
                  ? "new-bill-tab"
                  : pathname === href
                    ? "active"
                    : ""
              }
            >
              <I size={22} />
              <span>{String(label)}</span>
            </Link>
          );
        })}
      </nav>
      <BottomSheet
        open={search}
        onClose={() => setSearch(false)}
        title="Find a record"
      >
        <SearchInput
          value={q}
          onChange={setQ}
          label="Search customer name or phone"
        />
        {customers.error && (
          <ErrorState
            error={customers.error}
            retry={() => void customers.refetch()}
          />
        )}
        <div className="command-results">
          {customers.data?.rows.slice(0, 8).map((c) => (
            <Link
              onClick={() => setSearch(false)}
              key={c.id}
              href={`/customers/${c.id}`}
            >
              <Users size={18} />
              <span>
                {c.name}
                <small>{c.phone}</small>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
        <p className="muted">
          <Command size={13} /> Search begins after two characters.
        </p>
      </BottomSheet>
    </div>
  );
}
