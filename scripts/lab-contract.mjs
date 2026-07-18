import { extname } from "node:path";

const mediaTypes = Object.freeze({
  ".css": "text/css",
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".txt": "text/plain"
});

export const LAB_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "worker-src 'self'",
  "connect-src 'self'",
  "img-src 'none'",
  "font-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join("; ");

export const LAB_SECURITY_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-security-policy": LAB_CSP,
  "cross-origin-embedder-policy": "require-corp",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
});

export function labMediaType(path) {
  return mediaTypes[extname(path)] ?? "application/octet-stream";
}

export function labContentType(path) {
  const mediaType = labMediaType(path);
  return mediaType === "application/octet-stream" ? mediaType : `${mediaType}; charset=utf-8`;
}
