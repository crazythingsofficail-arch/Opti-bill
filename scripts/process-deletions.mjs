const origin = process.env.APP_URL,
  secret = process.env.CRON_SECRET;
if (!origin || !secret) throw new Error("APP_URL and CRON_SECRET are required");
const result = await fetch(new URL("/api/maintenance", origin), {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
  signal: AbortSignal.timeout(120000),
});
if (!result.ok)
  throw new Error(`Deletion worker returned HTTP ${result.status}`);
console.log(JSON.stringify(await result.json()));
