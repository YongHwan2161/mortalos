import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildLab } from "./build-lab.mjs";
import { LAB_SECURITY_HEADERS, labContentType } from "./lab-contract.mjs";
import { handleScenarioRequest } from "../functions/api/scenarios.js";
import { SCENARIO_CATALOG, SCENARIO_PROPOSAL_FORMAT } from "../lab/scenario-contract.mjs";

const root = fileURLToPath(new URL("../dist/lab", import.meta.url));
export { LAB_CSP, LAB_SECURITY_HEADERS } from "./lab-contract.mjs";

async function localScenarioFetch(_url, init) {
  const sent = JSON.parse(init.body);
  const modelInput = JSON.parse(sent.input);
  const [mutation, expected] = Object.entries(SCENARIO_CATALOG)
    .find(([, value]) => value.kind === modelInput.scenario_kind);
  const proposal = {
    format: SCENARIO_PROPOSAL_FORMAT,
    scenario_kind: expected.kind,
    mutation,
    prediction: { status: expected.status, code: expected.code },
    rationale: "Local acceptance fixture: the public deployment uses GPT-5.6 for this bounded choice."
  };
  return new Response(JSON.stringify({
    model: "gpt-5.6-sol-local-acceptance",
    status: "completed",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(proposal) }] }]
  }));
}

async function localScenarioResponse(request, origin) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8_192) return new Response(JSON.stringify({ error: "request_too_large" }), { status: 413 });
    chunks.push(chunk);
  }
  const headers = new Headers(request.headers);
  headers.set("cf-connecting-ip", "127.0.0.1");
  const webRequest = new Request(new URL(request.url || "/", origin), {
    method: request.method,
    headers,
    body: Buffer.concat(chunks)
  });
  return handleScenarioRequest({
    request: webRequest,
    env: {
      OPENAI_API_KEY: `local-acceptance-${"x".repeat(32)}`,
      SCENARIO_RATE_LIMITER: { limit: async () => ({ success: true }) }
    }
  }, { fetchImpl: localScenarioFetch });
}

export async function startLabServer({ host = "127.0.0.1", port = 0, directory = root } = {}) {
  const absoluteRoot = resolve(directory);
  const requests = [];
  const server = createServer(async (request, response) => {
    try {
      const origin = `http://${request.headers.host || host}`;
      const url = new URL(request.url || "/", origin);
      const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const path = resolve(absoluteRoot, `.${pathname}`);
      requests.push({ method: request.method, pathname: url.pathname });
      if (url.pathname === "/api/scenarios") {
        const webResponse = await localScenarioResponse(request, origin);
        response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()))
          .end(Buffer.from(await webResponse.arrayBuffer()));
        return;
      }
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
