import "server-only";
export function logEvent(
  event: string,
  detail: { requestId?: string; code?: string; durationMs?: number } = {},
) {
  console.info(
    JSON.stringify({ at: new Date().toISOString(), event, ...detail }),
  );
}
export async function captureError(error: unknown, requestId: string) {
  const code = error instanceof Error ? error.name : "UnknownError";
  console.error(JSON.stringify({ event: "request_failed", requestId, code }));
  // Sentry-ready boundary: send only error class and opaque request id, never payload/URL/PII.
  if (process.env.ERROR_WEBHOOK_URL)
    await fetch(process.env.ERROR_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, requestId }),
      signal: AbortSignal.timeout(1500),
    }).catch(() => undefined);
}
