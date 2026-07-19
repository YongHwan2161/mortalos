import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildLab } from "./build-lab.mjs";
import { LAB_SECURITY_HEADERS, labContentType } from "./lab-contract.mjs";
import { handleScenarioRequest } from "../functions/api/scenarios.js";
import { SCENARIO_CATALOG, SCENARIO_PROPOSAL_FORMAT } from "../lab/scenario-contract.mjs";
import { canonicalBytes, isCanonical, parseJsonBytes } from "../src/index.mjs";
import {
  createRelayFrame,
  decodeRelayMessageBytes,
  RELAY_LIMITS
} from "../src/transport/protocol.mjs";
import { RELAY_RATE_POLICY } from "../src/transport/relay-policy.mjs";

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

async function localTurnstileFetch() {
  return new Response(JSON.stringify({
    action: "mortalos_gpt_scenario",
    hostname: "mortal-os.com",
    success: true
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
      GPT_DAILY_REQUEST_CAP: "50",
      GPT_GLOBAL_MINUTE_CAP: "5",
      GPT_SCENARIOS_ENABLED: "true",
      SAFETY_IDENTIFIER_SECRET: `local-safety-${"s".repeat(32)}`,
      SCENARIO_RATE_DB: {
        prepare: () => ({ bind: (...keys) => ({ all: async () => ({
          results: keys.map((actor_key) => ({ actor_key, request_count: 1 }))
        }) }) })
      },
      TURNSTILE_EXPECTED_HOSTNAME: "mortal-os.com",
      TURNSTILE_SECRET_KEY: `local-turnstile-${"t".repeat(32)}`
    }
  }, { fetchImpl: localScenarioFetch, turnstileFetchImpl: localTurnstileFetch });
}

export async function startLabServer({ host = "127.0.0.1", port = 0, directory = root } = {}) {
  const absoluteRoot = resolve(directory);
  const requests = [];
  const relayRooms = new Map();
  const server = createServer(async (request, response) => {
    try {
      const origin = `http://${request.headers.host || host}`;
      const url = new URL(request.url || "/", origin);
      const routePath = url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname;
      const pathname = decodeURIComponent(routePath);
      const path = resolve(absoluteRoot, `.${pathname}`);
      requests.push({ method: request.method, pathname: url.pathname });
      const relayRoute = url.pathname.match(/^\/v1\/rooms\/([A-Za-z0-9_-]{22})\/(messages|presence)$/);
      if (relayRoute) {
        const [, roomId, action] = relayRoute;
        if (!relayRooms.has(roomId)) relayRooms.set(roomId, {
          frames: [],
          ids: new Map(),
          presence: new Map(),
          rate: { admitted: 0, bucket: null, count: 0, rejected: 0 }
        });
        const room = relayRooms.get(roomId);
        const rateBucket = Math.floor(Date.now() / 60_000);
        if (room.rate.bucket !== rateBucket) {
          room.rate.bucket = rateBucket;
          room.rate.count = 0;
        }
        room.rate.count += 1;
        if (room.rate.count > RELAY_RATE_POLICY.room_requests_per_minute) {
          room.rate.rejected += 1;
          response.writeHead(429, { "Cache-Control": "no-store", "Content-Type": "application/json" })
            .end('{"code":"RELAY_RATE","status":"reject"}');
          return;
        }
        room.rate.admitted += 1;
        if (action === "messages" && request.method === "POST") {
          const chunks = [];
          let size = 0;
          for await (const chunk of request) {
            size += chunk.length;
            if (size > RELAY_LIMITS.message_bytes) {
              response.writeHead(413, { "Content-Type": "application/json" }).end('{"code":"RELAY_LIMIT","status":"reject"}');
              return;
            }
            chunks.push(chunk);
          }
          const opened = decodeRelayMessageBytes(new Uint8Array(Buffer.concat(chunks)));
          const duplicate = room.ids.get(opened.message_id);
          const frame = duplicate ?? createRelayFrame(room.frames.length + 1, opened.bytes);
          if (!duplicate) {
            room.ids.set(opened.message_id, frame);
            room.frames.push(frame);
          }
          response.writeHead(duplicate ? 200 : 201, { "Cache-Control": "no-store", "Content-Type": "application/json" })
            .end(Buffer.from(canonicalBytes({ duplicate: Boolean(duplicate), frame })));
          return;
        }
        if (action === "messages" && request.method === "GET") {
          const after = Number(url.searchParams.get("after") ?? "0");
          const limit = Number(url.searchParams.get("limit") ?? String(RELAY_LIMITS.range_limit));
          if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > RELAY_LIMITS.range_limit) {
            response.writeHead(400, { "Content-Type": "application/json" }).end('{"code":"RELAY_SCHEMA","status":"reject"}');
            return;
          }
          const frames = room.frames.filter((frame) => frame.sequence > after).slice(0, limit);
          response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": "application/json" })
            .end(Buffer.from(canonicalBytes({ frames })));
          return;
        }
        if (action === "presence" && request.method === "POST") {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const bytes = new Uint8Array(Buffer.concat(chunks));
          const value = parseJsonBytes(bytes, { maxBytes: 1024, maxDepth: 4 });
          if (!isCanonical(bytes, value) || value.format !== "mortalos-relay-presence/1" || typeof value.endpoint_id !== "string") {
            response.writeHead(400, { "Content-Type": "application/json" }).end('{"code":"RELAY_SCHEMA","status":"reject"}');
            return;
          }
          const expiresAt = Date.now() + 4_000;
          room.presence.set(value.endpoint_id, expiresAt);
          response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": "application/json" })
            .end(Buffer.from(canonicalBytes({ endpoint_id: value.endpoint_id, expires_at: expiresAt })));
          return;
        }
        if (action === "presence" && request.method === "GET") {
          const now = Date.now();
          for (const [endpointId, expiresAt] of room.presence) if (expiresAt <= now) room.presence.delete(endpointId);
          response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": "application/json" })
            .end(Buffer.from(canonicalBytes({ endpoints: [...room.presence.keys()].sort() })));
          return;
        }
        response.writeHead(405, { "Content-Type": "application/json" }).end('{"code":"RELAY_METHOD","status":"reject"}');
        return;
      }
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
    relayMetrics: () => [...relayRooms.entries()].map(([room_id, room]) => ({
      admitted: room.rate.admitted,
      rejected: room.rate.rejected,
      room_id
    })),
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
