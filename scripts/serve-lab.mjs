import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildLab } from "./build-lab.mjs";
import { LAB_SECURITY_HEADERS, labContentType } from "./lab-contract.mjs";

const root = fileURLToPath(new URL("../dist/lab", import.meta.url));
export { LAB_CSP, LAB_SECURITY_HEADERS } from "./lab-contract.mjs";

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
        ...LAB_SECURITY_HEADERS,
        "Content-Type": labContentType(path)
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
