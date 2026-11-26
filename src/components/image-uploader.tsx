"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import { Button } from "./ui";
import { api } from "@/lib/client";
import { useToast } from "./providers";
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024)
    throw new Error("Choose an image under 20 MB");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  let size = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  try {
    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * size));
      canvas.height = Math.max(1, Math.round(bitmap.height * size));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image processing unavailable");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error("Image conversion failed")),
          "image/jpeg",
          Math.max(0.5, 0.88 - attempt * 0.06),
        ),
      );
      if (blob && blob.size <= 307200) return blob;
      size *= 0.8;
    }
    throw new Error("Image cannot be compressed below 300 KB");
  } finally {
    bitmap.close();
  }
}
export const compressWebp = compressImage;
export function ImageUploader({
  orderId,
  onPhotoChange,
  title = "Product / Lens photo",
  description = "Capture with camera or upload a photo. Compressed to JPG, up to 300 KB.",
}: {
  orderId: string | null;
  onPhotoChange?: (url: string | null) => void;
  title?: string;
  description?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [camOpen, setCamOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null),
    videoRef = useRef<HTMLVideoElement>(null),
    streamRef = useRef<MediaStream | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (orderId)
      void api<{ url: string | null }>(`lens-photo?id=${orderId}`)
        .then((r) => {
          setPreview(r.url);
          onPhotoChange?.(r.url);
        })
        .catch(() => undefined);
  }, [orderId]);
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  function stopWebcam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOpen(false);
  }
  async function openCamera() {
    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    ) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        streamRef.current = stream;
        setCamOpen(true);
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play();
          }
        });
        return;
      } catch {
        // Fallback to native file/camera input if webcam permission denied or unavailable
      }
    }
    camera.current?.click();
  }
  async function captureFromWebcam() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
    );
    stopWebcam();
    if (blob) {
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      await upload(file);
    }
  }
  async function upload(file: File | undefined) {
    if (!file || !orderId) return;
    try {
      setBusy(true);
      if (!navigator.onLine) throw new Error("Reconnect before uploading");
      const blob = await compressImage(file);
      const form = new FormData();
      form.set("order_id", orderId);
      form.set("file", blob, "lens.jpg");
      const res = await fetch("/api/lens-upload", {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const signed = await api<{ url: string }>(`lens-photo?id=${orderId}`);
      setPreview(signed.url);
      onPhotoChange?.(signed.url);
      toast("Photo saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
      if (camera.current) camera.current.value = "";
    }
  }
  return (
    <div className="image-uploader">
      <h3>{title}</h3>
      <p className="section-note">{description}</p>
      {preview && <img src={preview} alt="Captured eyewear" />}
      {camOpen && (
        <div
          style={{
            margin: "12px 0",
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: 8,
              display: "block",
              margin: "0 auto 10px",
              background: "#000",
            }}
          />
          <div className="row" style={{ justifyContent: "center", gap: 10 }}>
            <Button type="button" onClick={() => void captureFromWebcam()}>
              <Camera size={16} />
              Take Snapshot
            </Button>
            <Button type="button" variant="ghost" onClick={stopWebcam}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <div className="row wrap" style={{ justifyContent: "center" }}>
        <Button
          variant="secondary"
          type="button"
          disabled={!orderId || busy}
          onClick={() => input.current?.click()}
        >
          <Upload size={15} />
          {busy ? "Processing…" : preview ? "Replace" : "Upload"}
        </Button>
        <Button
          variant="ghost"
          type="button"
          disabled={!orderId || busy}
          onClick={() => void openCamera()}
        >
          <Camera size={17} />
          Take photo
        </Button>
        {preview && (
          <Button
            variant="ghost"
            type="button"
            onClick={async () => {
              try {
                await api("lens-remove", { id: orderId });
                setPreview(null);
                onPhotoChange?.(null);
              } catch (e) {
                toast(e instanceof Error ? e.message : "Unable to remove");
              }
            }}
          >
            Remove
          </Button>
        )}
      </div>
      {!orderId && (
        <small>Choose a customer and save the draft to enable upload.</small>
      )}
    </div>
  );
}
export function BrandUploader({
  kind,
  configured,
  imageUrl,
}: {
  kind: "logo" | "signature";
  configured: boolean;
  imageUrl?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="image-uploader">
      <h3>{kind === "logo" ? "Shop logo" : "Authorised signature"}</h3>
      <p className="section-note">
        {configured ? "An image is configured." : "No image configured."} Old
        invoice copies retain their original branding.
      </p>
      {configured && (imageUrl || kind === "logo") && (
        <div style={{ margin: "12px 0" }}>
          <img
            src={imageUrl || "/logo.png"}
            alt={kind === "logo" ? "Configured logo" : "Configured signature"}
            style={{
              height: 44,
              maxWidth: 160,
              objectFit: "contain",
              borderRadius: 6,
              border: "1px solid var(--border, #e2e8f0)",
              padding: 3,
            }}
          />
        </div>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept="image/*"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            setBusy(true);
            const blob = await compressImage(f);
            const form = new FormData();
            form.set("kind", kind);
            form.set("file", blob, `${kind}.jpg`);
            const res = await fetch("/api/brand-upload", {
              method: "POST",
              body: form,
            });
            if (!res.ok) throw new Error((await res.json()).error);
            window.location.reload();
          } catch (error) {
            toast(error instanceof Error ? error.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        variant="secondary"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? "Uploading…" : configured ? "Replace image" : "Upload image"}
      </Button>
      {configured && (
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              await api("brand-remove", { kind });
              window.location.reload();
            } catch (e) {
              toast(e instanceof Error ? e.message : "Unable to remove");
            }
          }}
        >
          Remove from future bills
        </Button>
      )}
    </div>
  );
}
