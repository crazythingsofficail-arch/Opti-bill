import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CLOUD_BUCKET = "opti-x-data";
const STORE_KEY = "store.json";
const BACKUP_KEY = "store.json.bak";

let clientCache: SupabaseClient | null = null;
let bucketEnsured = false;

export function isTestEnvironment(): boolean {
  return Boolean(
    process.env.VITEST ||
      process.env.NODE_ENV === "test" ||
      process.env.OPTI_STORE_PATH ||
      process.env.OPTI_DATA_DIR,
  );
}

function getSupabaseCredentials(): { url: string; key: string } | null {
  if (isTestEnvironment()) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isCloudStorageEnabled(): boolean {
  return getSupabaseCredentials() !== null;
}

function getSupabaseAdmin(): SupabaseClient | null {
  const creds = getSupabaseCredentials();
  if (!creds) return null;
  if (!clientCache) {
    clientCache = createClient(creds.url, creds.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return clientCache;
}

async function ensureBucket(client: SupabaseClient): Promise<void> {
  if (bucketEnsured) return;
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) {
    throw new Error(`Supabase bucket list failed: ${error.message}`);
  }
  if (!buckets?.some((b) => b.name === CLOUD_BUCKET)) {
    const { error: createErr } = await client.storage.createBucket(CLOUD_BUCKET, {
      public: false,
      fileSizeLimit: 15 * 1024 * 1024,
      allowedMimeTypes: [
        "application/json",
        "text/plain",
        "image/jpeg",
        "image/png",
        "image/webp",
      ],
    });
    if (createErr && !createErr.message.toLowerCase().includes("already exists")) {
      throw new Error(`Supabase bucket creation failed: ${createErr.message}`);
    }
  }
  bucketEnsured = true;
}

export async function readCloudStore(): Promise<string | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;
  await ensureBucket(client);

  for (const key of [STORE_KEY, BACKUP_KEY]) {
    const { data, error } = await client.storage.from(CLOUD_BUCKET).download(key);
    if (!error && data) {
      const text = await data.text();
      try {
        JSON.parse(text);
        return text;
      } catch {
        console.warn(`Cloud store file ${key} is corrupted, checking fallback.`);
      }
    }
  }
  return null;
}

export async function writeCloudStore(jsonStr: string): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  await ensureBucket(client);

  const body = Buffer.from(jsonStr, "utf8");
  const primary = await client.storage
    .from(CLOUD_BUCKET)
    .upload(STORE_KEY, body, {
      contentType: "application/json",
      upsert: true,
    });
  if (primary.error) {
    throw new Error(`Failed to persist cloud store: ${primary.error.message}`);
  }

  // Write backup non-fatally after primary succeeds
  await client.storage
    .from(CLOUD_BUCKET)
    .upload(BACKUP_KEY, body, {
      contentType: "application/json",
      upsert: true,
    })
    .catch((err) => console.warn("Cloud backup upload warning:", err));
}

export async function uploadCloudAsset(
  filename: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  await ensureBucket(client);

  const { error } = await client.storage
    .from(CLOUD_BUCKET)
    .upload(`uploads/${filename}`, bytes, {
      contentType,
      upsert: true,
    });
  if (error) {
    throw new Error(`Cloud asset upload failed: ${error.message}`);
  }
}

export async function downloadCloudAsset(
  filename: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const client = getSupabaseAdmin();
  if (!client) return null;
  await ensureBucket(client);

  const { data, error } = await client.storage
    .from(CLOUD_BUCKET)
    .download(`uploads/${filename}`);
  if (error || !data) return null;
  const arr = await data.arrayBuffer();
  return {
    bytes: Buffer.from(arr),
    contentType: data.type || "application/octet-stream",
  };
}

export async function deleteCloudAsset(filename: string): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  await ensureBucket(client);
  await client.storage
    .from(CLOUD_BUCKET)
    .remove([`uploads/${filename}`])
    .catch(() => undefined);
}
