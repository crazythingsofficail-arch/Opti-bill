"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Profile, Shop } from "@/lib/types";
const Workspace = createContext<{ profile: Profile; shop: Shop } | null>(null);
const Toast = createContext<(message: string) => void>(() => undefined);
export function useWorkspace() {
  const ctx = useContext(Workspace);
  if (!ctx) throw new Error("Workspace unavailable");
  return ctx;
}
export const useToast = () => useContext(Toast);
export function Providers({
  children,
  profile,
  shop,
}: {
  children: ReactNode;
  profile?: Profile;
  shop?: Shop;
}) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 20000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return (
    <QueryClientProvider client={client}>
      <Workspace.Provider value={profile && shop ? { profile, shop } : null}>
        <Toast.Provider value={setMessage}>
          {children}
          <div
            className={`toast ${message ? "visible" : ""}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
        </Toast.Provider>
      </Workspace.Provider>
    </QueryClientProvider>
  );
}
