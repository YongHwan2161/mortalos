import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildLab } from "./build-lab.mjs";

const root = fileURLToPath(new URL("../dist/lab", import.meta.url));
const types = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"]
]);

export const LAB_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "worker-src 'self'",
  "connect-src 'none'",
  "img-src 'none'",
  "font-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join("; ");

export async function startLabServer({ host = "127.0.0.1", port = 0, directory = root } = {}) {
  const absoluteRoot = resolve(directory);
  const requests = [];
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://${host}`);
      const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const path = resolve(absoluteRoot, `.${pathname}`);
      requests.push({ method: request.method, pathname: url.pathname });
      if (path !== absoluteRoot && !path.startsWith(`${absoluteRoot}${sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const info = await stat(path);
      if (!info.isFile()) throw new Error("not a file");
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Security-Policy": LAB_CSP,
        "Content-Type": types.get(extname(path)) ?? "application/octet-stream",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff"
      });
      createReadStream(path).pipe(response);
    } catch {
      response.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff"
      }).end("Not found");
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Lab server address unavailable");
  return {
    url: `http://${host}:${address.port}`,
    requests,
    close: () => new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()))
  };
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  await buildLab();
  const running = await startLabServer({ port: Number(process.env.PORT || 4173) });
  console.log(`MortalOS Lab: ${running.url}`);
  console.log("Press Ctrl+C to stop.");
}
