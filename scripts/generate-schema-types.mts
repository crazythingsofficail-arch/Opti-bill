/** Offline schema snapshot generator. Production regeneration uses npm run db:types (Supabase CLI).
 * Uses only migrations and an empty Postgres engine; creates no business records. */
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir, writeFile } from "node:fs/promises";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select null::uuid$$;create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key,bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(v text) returns text[] language sql as $$select string_to_array(v,'/')$$;`,
);
for (const f of (await readdir("supabase/migrations")).sort())
  await db.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
const columns = (
  await db.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(
    "select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
  )
).rows;
const tables = (
  await db.query<{ table_name: string; table_type: string }>(
    "select table_name,table_type from information_schema.tables where table_schema='public'",
  )
).rows;
function type(sql: string) {
  return sql === "boolean"
    ? "boolean"
    : [
          "integer",
          "bigint",
          "numeric",
          "smallint",
          "real",
          "double precision",
        ].includes(sql)
      ? "number"
      : ["json", "jsonb"].includes(sql)
        ? "Json"
        : "string";
}
let out =
  "// Generated from the executed migrations. Regenerate against Supabase with npm run db:types.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = { public: { Tables: {\n";
for (const table of tables.filter((t) => t.table_type === "BASE TABLE")) {
  const cols = columns.filter((c) => c.table_name === table.table_name);
  out += `${table.table_name}: {\nRow: {\n${cols.map((c) => `${c.column_name}: ${type(c.data_type)}${c.is_nullable === "YES" ? " | null" : ""};`).join("\n")}\n};\nInsert: {\n${cols.map((c) => `${c.column_name}${c.column_default || c.is_nullable === "YES" ? "?" : ""}: ${type(c.data_type)}${c.is_nullable === "YES" ? " | null" : ""};`).join("\n")}\n};\nUpdate: {\n${cols.map((c) => `${c.column_name}?: ${type(c.data_type)}${c.is_nullable === "YES" ? " | null" : ""};`).join("\n")}\n}; Relationships: [] };\n`;
}
out += "}; Views: {\n";
for (const table of tables.filter((t) => t.table_type === "VIEW"))
  out += `${table.table_name}: { Row: {${columns
    .filter((c) => c.table_name === table.table_name)
    .map((c) => `${c.column_name}: ${type(c.data_type)} | null`)
    .join(";")}}; Relationships: []};\n`;
const functions = (
  await db.query<{
    name: string;
    args: string[] | null;
    types: string[];
    defaults: number;
    returns: string;
  }>(
    `select p.proname name,p.proargnames args,array(select format_type(t,null) from unnest(p.proargtypes::oid[]) t) types,p.pronargdefaults defaults,format_type(p.prorettype,null) returns from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname`,
  )
).rows;
out += "}; Functions: {\n";
for (const f of functions)
  out += `${f.name}: { Args: { ${(f.args || []).map((a, i) => `${a}${i >= f.types.length - f.defaults ? "?" : ""}: ${type(f.types[i])}`).join("; ")} }; Returns: ${f.returns === "void" ? "undefined" : type(f.returns)} };\n`;
out +=
  "}; Enums: Record<string, never>; CompositeTypes: Record<string, never>; } };\n";
await writeFile("src/supabase/database.generated.ts", out);
await db.close();
console.log(
  `Generated ${tables.length} table/view definitions and ${functions.length} RPC signatures.`,
);
