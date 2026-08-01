import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const token = process.env.MORTALOS_COUNTER_REPLICA_TOKEN;
const dataFile = process.env.MORTALOS_COUNTER_REPLICA_DATA_FILE;
const port = Number(process.env.MORTALOS_COUNTER_REPLICA_PORT ?? "0");
if (!token || token.length < 16 || !dataFile || !Number.isSafeInteger(port)) {
  throw new Error("counter replica token, data file, and port are required");
}

let records = {};
try {
  records = JSON.parse(await readFile(dataFile, "utf8"));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
let tail = Promise.resolve();

async function persist() {
  await mkdir(dirname(dataFile), { recursive: true });
  const temporary = `${dataFile}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(records), "utf8");
  await rename(temporary, dataFile);
}

function respond(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

const server = createServer((request, response) => {
  if (request.method !== "POST" || request.headers.authorization !== `Bearer ${token}`) {
    respond(response, 401, { error: "unauthorized" });
    return;
  }
  const chunks = [];
  let size = 0;
  request.on("data", (chunk) => {
    size += chunk.byteLength;
    if (size > 1_048_576) request.destroy();
    else chunks.push(chunk);
  });
  request.on("end", () => {
    const operation = new URL(request.url, "http://counter-replica.invalid").pathname.slice(1);
    const task = async () => {
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        respond(response, 400, { error: "json" });
        return;
      }
      if (typeof body.epochId !== "string" || body.epochId.length > 128) {
        respond(response, 400, { error: "epoch" });
        return;
      }
      const current = records[body.epochId] ?? null;
      if (operation === "read") {
        respond(response, 200, { value: current });
        return;
      }
      if (operation === "cas") {
        if ((current?.revision ?? null) !== body.expectedRevision) {
          respond(response, 200, { accepted: false });
          return;
        }
        if (body.next === null) delete records[body.epochId];
        else records[body.epochId] = structuredClone(body.next);
        await persist();
        respond(response, 200, { accepted: true });
        return;
      }
      if (operation === "repair") {
        if (body.committed === null) {
          respond(response, 200, { repaired: current === null });
          return;
        }
        if ((current?.revision ?? -1) > body.committed.revision) {
          respond(response, 200, { repaired: false });
          return;
        }
        records[body.epochId] = structuredClone(body.committed);
        await persist();
        respond(response, 200, { repaired: true });
        return;
      }
      respond(response, 404, { error: "operation" });
    };
    tail = tail.then(task, task);
  });
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", resolve);
});
const address = server.address();
console.log(JSON.stringify({ ready: true, url: `http://127.0.0.1:${address.port}/` }));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
