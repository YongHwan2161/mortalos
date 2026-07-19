import { extname } from "node:path";
import { MORTALOS_RELAY_ORIGIN, MORTALOS_SAFE_API_ORIGIN } from "../lab/runtime-endpoints.mjs";

const mediaTypes = Object.freeze({
  ".css": "text/css",
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".txt": "text/plain"
});

export const LAB_CSP = [
  "default-src 'none'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self'",
  "worker-src 'self'",
  `connect-src 'self' ${MORTALOS_SAFE_API_ORIGIN} ${MORTALOS_RELAY_ORIGIN} https://challenges.cloudflare.com`,
  "frame-src https://challenges.cloudflare.com",
  "img-src 'none'",
  "font-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join("; ");

export const LAB_SECURITY_HEADERS = Object.freeze({
  "cache-control": "no-store, no-transform",
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
