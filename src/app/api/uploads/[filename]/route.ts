import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { verifySessionToken, verifyShareToken } from "@/lib/auth-security";
import { getUploadsDir } from "@/lib/store";
import { downloadCloudAsset, isCloudStorageEnabled } from "@/lib/cloud-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ filename: string }> };

function mimeForExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

export async function GET(request: NextRequest, { params }: Params) {
  const { filename } = await params;

  const sessionToken = request.cookies.get("opti-activity")?.value;
  const shareToken = request.nextUrl.searchParams.get("share");
  const isAuthed =
    verifySessionToken(sessionToken, 8 * 60).valid ||
    verifyShareToken(shareToken).valid;

  if (!isAuthed) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (isCloudStorageEnabled()) {
    const asset = await downloadCloudAsset(filename);
    if (asset) {
      return new NextResponse(new Uint8Array(asset.bytes), {
        status: 200,
        headers: {
          "Content-Type": mimeForExt(filename),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }
  }

  const candidates = [
    path.join(getUploadsDir(), filename),
    path.join(process.cwd(), "public", "uploads", filename),
  ];

  for (const filepath of candidates) {
    try {
      const bytes = await fs.readFile(filepath);
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "Content-Type": mimeForExt(filename),
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch {}
  }

  return NextResponse.json({ error: "Asset not found" }, { status: 404 });
}
