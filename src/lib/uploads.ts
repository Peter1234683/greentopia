import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// MVP: 로컬 디스크(storage/uploads)에 저장. 추후 S3/Supabase Storage 어댑터로 교체.
const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export function validateUpload(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return "파일은 5MB 이하만 올릴 수 있어요.";
  if (!ALLOWED.includes(file.type)) return "PDF 또는 이미지(PNG·JPG·WEBP) 파일만 올릴 수 있어요.";
  return null;
}

export async function saveUpload(file: File) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name).slice(0, 10).replace(/[^.\w]/g, "");
  const stored = `${randomUUID()}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()));
  return { path: `uploads/${stored}`, originalName: file.name, mimeType: file.type, size: file.size };
}
