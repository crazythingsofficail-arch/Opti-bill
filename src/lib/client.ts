export async function api<T>(resource: string, body?: unknown): Promise<T> {
  if (
    typeof navigator !== "undefined" &&
    !navigator.onLine &&
    body !== undefined
  )
    throw new Error("You are offline. Reconnect before saving.");
  const res = await fetch(`/api/${resource}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function displayDate(d: string | null | undefined) {
  return d
    ? new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date(d.length === 10 ? d + "T00:00:00+05:30" : d))
    : "—";
}

export function dayAfter(days: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + days * 86400000));
}
