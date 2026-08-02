import assert from "node:assert/strict";
import { fork, spawn } from "node:child_process";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CONTINUITY_SCENARIO_FORMAT,
  CONTINUITY_SCENARIO_STEPS,
  continueContinuity,
  createContinuity,
  createContinuityAuthority,
  describeContinuityAuthority,
  handoffContinuity,
  inspectContinuity,
  recoverContinuity
} from "../sdk/continuity.mjs";
import { decodeBase64Url, derivePeerId, encodeBase64Url } from "../src/index.mjs";
import { loadNodeAuthority } from "../cli/node-authority.mjs";

const endpointPath = new URL("./continuity-node-endpoint.mjs", import.meta.url);

assert.equal(CONTINUITY_SCENARIO_FORMAT, "mortalos-continuity-scenario/1");
assert.deepEqual(CONTINUITY_SCENARIO_STEPS, [
  "create-real-resource",
  "request-custody",
  "propose-handoff",
  "accept-handoff",
  "terminate-origin",
  "recover-two-of-three",
  "continue-lineage",
  "verify-fresh-process"
]);

async function endpoint() {
  const child = fork(endpointPath, [], {
    serialization: "json",
    stdio: ["ignore", "ignore", "inherit", "ipc"]
  });
  const ready = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.on("message", (message) => {
      if (message?.event === "ready") resolve(message);
    });
  });
  let identifier = 0;
  return {
    child,
    ready,
    request(command) {
      const id = ++identifier;
      return new Promise((resolve, reject) => {
        function receive(message) {
          if (message?.id !== id) return;
          child.off("message", receive);
          if (message.ok) resolve(message.result);
          else {
            const error = new Error(message.error.message);
            error.code = message.error.code;
            reject(error);
          }
        }
        child.on("message", receive);
        child.send({ ...command, id }, (error) => {
          if (!error) return;
          child.off("message", receive);
          reject(error);
        });
      });
    }
  };
}

function exitedProcess(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return error?.code === "ESRCH";
  }
}

function nodeAuthoritySigner(authorityPath, byte) {
  const moduleUrl = new URL("../cli/node-authority.mjs", import.meta.url).href;
  const source = `
    const { loadNodeAuthority } = await import(${JSON.stringify(moduleUrl)});
    try {
      const authority = await loadNodeAuthority(${JSON.stringify(authorityPath)});
      await authority.sign({
        message: new Uint8Array([${byte}]),
        tuple: "pulse.race-organism.7.parent"
      });
      process.stdout.write("signed");
    } catch (error) {
      process.stderr.write(String(error?.code ?? error));
      process.exitCode = 17;
    }
  `;
  const child = spawn(process.execPath, ["--input-type=module", "--eval", source], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  let stdout = "";
  child.stderr.setEncoding("utf8");
  child.stdout.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stderr, stdout }));
  });
}

function nodeAuthorityCreator(authorityPath) {
  const moduleUrl = new URL("../cli/node-authority.mjs", import.meta.url).href;
  const source = `
    const { loadNodeAuthority } = await import(${JSON.stringify(moduleUrl)});
    try {
      const authority = await loadNodeAuthority(${JSON.stringify(authorityPath)}, { create: true });
      process.stdout.write(authority.custodian.key_id);
    } catch (error) {
      process.stderr.write(String(error?.code ?? error));
      process.exitCode = 17;
    }
  `;
  const child = spawn(process.execPath, ["--input-type=module", "--eval", source], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  let stdout = "";
  child.stderr.setEncoding("utf8");
  child.stdout.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stderr, stdout }));
  });
}

function runtimeResource(size = 131_073) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes.subarray(0, Math.min(bytes.length, 65_536)));
  for (let index = 65_536; index < bytes.length; index += 1) {
    bytes[index] = (bytes[index - 65_536] + index * 17) & 0xff;
  }
  return bytes;
}

function unsafeAuthority() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const public_key = `ed25519:${encodeBase64Url(der.subarray(-32))}`;
  const custodian = Object.freeze({ key_id: derivePeerId(public_key), public_key });
  return Object.freeze({
    custodian,
    async sign({ message }) {
      return Object.freeze({
        key_id: custodian.key_id,
        signature: `ed25519:${encodeBase64Url(sign(null, message, privateKey))}`
      });
    }
  });
}

async function transferred(resourceBytes = runtimeResource()) {
  const authorityA = await createContinuityAuthority();
  const authorityB = await createContinuityAuthority();
  const created = await createContinuity({
    authority: authorityA,
    resourceBytes,
    transitionId: "runtime-file-create"
  });
  const request = await handoffContinuity({
    authority: authorityB,
    capsuleBytes: created.capsule_bytes,
    phase: "request"
  });
  const proposal = await handoffContinuity({
    authority: authorityA,
    capsuleBytes: created.capsule_bytes,
    phase: "propose",
    request
  });
  const handed = await handoffContinuity({
    authority: authorityB,
    capsuleBytes: created.capsule_bytes,
    phase: "accept",
    proposal
  });
  return { authorityA, authorityB, created, handed, proposal, request, resourceBytes };
}

test("real runtime bytes move to B, recover from 2-of-3, and continue after A is destroyed", async () => {
  const fixture = await transferred();
  const before = inspectContinuity({ capsuleBytes: fixture.handed.capsule_bytes });
  assert.equal(before.sequence, "2");
  assert.equal(before.current_custodians[0].key_id, fixture.request.custodian.key_id);
  fixture.authorityA.destroy();

  const corrupt = new Uint8Array(fixture.handed.copies[0]);
  corrupt[Math.floor(corrupt.length / 2)] ^= 1;
  const recovered = recoverContinuity({
    authority: fixture.authorityB,
    copies: [corrupt, fixture.handed.copies[1], fixture.handed.copies[2]],
    expectedHeadHash: fixture.handed.head_hash,
    expectedOrganismId: fixture.handed.organism_id,
    quorum: 2
  });
  assert.deepEqual(recovered.resource_bytes, fixture.resourceBytes);
  assert.equal(recovered.rejected_copies.length, 1);
  assert.equal(recovered.valid_copies, 2);

  const continued = await continueContinuity({
    authority: fixture.authorityB,
    capsuleBytes: recovered.capsule_bytes,
    expectedHeadHash: recovered.head_hash,
    resourceBytes: recovered.resource_bytes,
    transitionId: "runtime-file-continued"
  });
  assert.equal(continued.organism_id, fixture.created.organism_id);
  assert.equal(continued.sequence, "3");
  assert.deepEqual(
    recoverContinuity({
      authority: fixture.authorityB,
      copies: continued.copies,
      expectedHeadHash: continued.head_hash,
      expectedOrganismId: continued.organism_id,
      quorum: 2
    }).resource_bytes,
    fixture.resourceBytes
  );
  assert.ok(continued.provider_receipts.every(({ transport }) =>
    transport === "relay-fragment-data-plane"));

  const publicArtifacts = JSON.stringify({
    created: new TextDecoder().decode(fixture.created.capsule_bytes),
    handed: new TextDecoder().decode(fixture.handed.capsule_bytes),
    proposal: fixture.proposal,
    request: fixture.request
  });
  assert.doesNotMatch(publicArtifacts, /private|pkcs8|CryptoKey|BEGIN PRIVATE KEY/iu);
  assert.deepEqual(describeContinuityAuthority(fixture.authorityB), {
    custodian: fixture.request.custodian,
    non_extractable: true,
    private_material_exposed: false
  });
});

test("B continues from a real file after the accepted handoff and actual A process exit", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-node-continuity-"));
  const resourcePath = join(directory, "runtime-resource.bin");
  const resource = runtimeResource(98_317);
  await writeFile(resourcePath, resource);
  const endpointA = await endpoint();
  const endpointB = await endpoint();
  t.after(async () => {
    for (const candidate of [endpointA.child, endpointB.child]) {
      if (candidate.connected) candidate.kill();
    }
    await rm(directory, { force: true, recursive: true });
  });

  const created = await endpointA.request({ command: "create", resource_path: resourcePath });
  const request = await endpointB.request({ command: "handoff-request", capsule: created.capsule });
  const proposal = await endpointA.request({
    capsule: created.capsule,
    command: "handoff-propose",
    request
  });
  const handed = await endpointB.request({
    capsule: created.capsule,
    command: "handoff-accept",
    proposal
  });
  assert.equal(handed.sequence, "2");
  assert.equal(request.custodian.key_id, endpointB.ready.custodian.key_id);

  const originPid = endpointA.child.pid;
  const originExit = new Promise((resolve) => endpointA.child.once("exit", resolve));
  assert.deepEqual(await endpointA.request({ command: "terminate" }), {
    status: "authority-destroyed"
  });
  assert.equal(await originExit, 0);
  assert.equal(exitedProcess(originPid), true);

  const corrupt = decodeBase64Url(handed.copies[0]);
  corrupt[Math.floor(corrupt.length / 2)] ^= 1;
  const recovered = await endpointB.request({
    command: "recover",
    copies: [encodeBase64Url(corrupt), handed.copies[1], handed.copies[2]],
    expected_head: handed.head_hash,
    expected_organism: handed.organism_id
  });
  assert.deepEqual(decodeBase64Url(recovered.resource), resource);
  assert.equal(recovered.rejected_copies, 1);
  assert.equal(recovered.valid_copies, 2);

  const continued = await endpointB.request({
    capsule: recovered.capsule,
    command: "continue",
    expected_head: recovered.head_hash,
    resource: recovered.resource
  });
  assert.equal(continued.organism_id, handed.organism_id);
  assert.equal(continued.sequence, "3");
  assert.notEqual(continued.head_hash, handed.head_hash);
});

test("single copy, stale lineage, wrong authority, and divergent valid capsules fail closed", async () => {
  const fixture = await transferred(runtimeResource(65_537));
  assert.throws(
    () => recoverContinuity({
      authority: fixture.authorityB,
      copies: [fixture.handed.copies[0]],
      expectedHeadHash: fixture.handed.head_hash,
      quorum: 2
    }),
    (error) => error.code === "E_CONTINUITY_QUORUM"
  );
  assert.throws(
    () => recoverContinuity({
      authority: fixture.authorityB,
      copies: [fixture.handed.copies[0], fixture.handed.copies[0]],
      expectedHeadHash: fixture.handed.head_hash,
      quorum: 2
    }),
    (error) => error.code === "E_CONTINUITY_DUPLICATE_COPY"
  );
  assert.throws(
    () => recoverContinuity({
      authority: fixture.authorityA,
      copies: fixture.created.copies,
      expectedHeadHash: fixture.handed.head_hash,
      quorum: 2
    }),
    (error) => error.code === "E_CONTINUITY_STALE_HEAD"
  );
  assert.throws(
    () => recoverContinuity({
      authority: fixture.authorityA,
      copies: fixture.handed.copies,
      expectedHeadHash: fixture.handed.head_hash,
      quorum: 2
    }),
    (error) => error.code === "E_CONTINUITY_AUTHORITY"
  );

  const malicious = unsafeAuthority();
  const created = await createContinuity({
    authority: malicious,
    resourceBytes: runtimeResource(32_769),
    transitionId: "fork-create"
  });
  const left = await continueContinuity({
    authority: malicious,
    capsuleBytes: created.capsule_bytes,
    expectedHeadHash: created.head_hash,
    transitionId: "fork-left"
  });
  const right = await continueContinuity({
    authority: malicious,
    capsuleBytes: created.capsule_bytes,
    expectedHeadHash: created.head_hash,
    transitionId: "fork-right"
  });
  assert.throws(
    () => recoverContinuity({
      authority: malicious,
      copies: [left.copies[0], left.copies[1], right.copies[2]],
      quorum: 2
    }),
    (error) => error.code === "E_CUSTODY_EQUIVOCATION"
  );
});

test("local CLI authority serializes concurrent creation and conflicting cross-process sign-once attempts", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-authority-race-"));
  const authorityPath = join(directory, "missing-parent", "authority.json");
  t.after(() => rm(directory, { force: true, recursive: true }));
  const created = await Promise.all(Array.from(
    { length: 4 },
    () => nodeAuthorityCreator(authorityPath)
  ));
  assert.equal(created.every(({ code, stderr }) => code === 0 && stderr === ""), true);
  assert.equal(new Set(created.map(({ stdout }) => stdout)).size, 1);
  const authorityDocument = JSON.parse(await readFile(authorityPath, "utf8"));
  assert.equal(authorityDocument.custodian.key_id, created[0].stdout);
  const tuple = "pulse.race-organism.7.parent";
  const results = await Promise.all([
    nodeAuthoritySigner(authorityPath, 1),
    nodeAuthoritySigner(authorityPath, 2)
  ]);
  const signed = results.filter(({ code, stdout }) => code === 0 && stdout === "signed");
  const rejected = results.filter(({ code, stderr }) =>
    code === 17 && stderr === "E_CONTINUITY_EQUIVOCATION");
  assert.equal(signed.length, 1);
  assert.equal(rejected.length, 1);
  const document = JSON.parse(await readFile(authorityPath, "utf8"));
  assert.equal(document.custodian.key_id, created[0].stdout);
  assert.equal(Object.keys(document.sign_once).length, 1);
  assert.ok([
    encodeBase64Url(new Uint8Array([1])),
    encodeBase64Url(new Uint8Array([2]))
  ].includes(document.sign_once[tuple]));
});

test("local CLI authority stale lock fails closed without identity or journal mutation", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-authority-lock-"));
  const authorityPath = join(directory, "nested", "authority.json");
  const lockPath = `${authorityPath}.lock`;
  t.after(() => rm(directory, { force: true, recursive: true }));
  await mkdir(join(directory, "nested"), { recursive: true });
  await writeFile(lockPath, "operator-owned-stale-lock", "utf8");
  await assert.rejects(
    loadNodeAuthority(authorityPath, { create: true }),
    (error) => error.code === "E_CONTINUITY_AUTHORITY_LOCK"
  );
  await assert.rejects(readFile(authorityPath), (error) => error.code === "ENOENT");
  assert.equal(await readFile(lockPath, "utf8"), "operator-owned-stale-lock");

  await rm(lockPath);
  const authority = await loadNodeAuthority(authorityPath, { create: true });
  const before = await readFile(authorityPath, "utf8");
  await writeFile(lockPath, "operator-owned-stale-lock", "utf8");
  await assert.rejects(
    authority.sign({ message: new Uint8Array([7]), tuple: "pulse.lock.1.parent" }),
    (error) => error.code === "E_CONTINUITY_AUTHORITY_LOCK"
  );
  assert.equal(await readFile(authorityPath, "utf8"), before);
  assert.equal(await readFile(lockPath, "utf8"), "operator-owned-stale-lock");
});

test("local CLI authority rejects persisted private-material smuggling in public custodian", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-authority-redaction-"));
  const authorityPath = join(directory, "authority.json");
  t.after(() => rm(directory, { force: true, recursive: true }));
  await loadNodeAuthority(authorityPath, { create: true });
  const document = JSON.parse(await readFile(authorityPath, "utf8"));
  document.custodian.private_pkcs8_base64url = document.private_pkcs8_base64url;
  await writeFile(authorityPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  await assert.rejects(
    loadNodeAuthority(authorityPath),
    /local authority custodian has unexpected keys/u
  );

  delete document.custodian.private_pkcs8_base64url;
  await writeFile(authorityPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  const authority = await loadNodeAuthority(authorityPath);
  assert.deepEqual(Object.keys(authority.custodian).sort(), ["key_id", "public_key"]);
  assert.doesNotMatch(JSON.stringify(authority), /private|pkcs8/iu);
});

test("local CLI authority journal rejects transient JSON and Object prototype lies", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "mortalos-authority-prototype-"));
  const authorityPath = join(directory, "authority.json");
  t.after(() => rm(directory, { force: true, recursive: true }));
  const authority = await loadNodeAuthority(authorityPath, { create: true });
  const tuple = "pulse.attack.slot";
  await authority.sign({ message: new Uint8Array([1]), tuple });
  const jsonParse = JSON.parse;
  let jsonError = null;
  try {
    JSON.parse = function poisonedJsonParse(...args) {
      JSON.parse = jsonParse;
      const document = jsonParse(...args);
      document.sign_once = {};
      return document;
    };
    try {
      await authority.sign({ message: new Uint8Array([2]), tuple });
    } catch (error) {
      jsonError = error;
    }
  } finally {
    JSON.parse = jsonParse;
  }
  assert.ok([
    "E_CONTINUITY_EQUIVOCATION",
    "E_CONTINUITY_RUNTIME"
  ].includes(jsonError?.code));

  let prototypeError = null;
  try {
    Object.defineProperty(Object.prototype, tuple, {
      configurable: true,
      get() { return undefined; },
      set() {}
    });
    try {
      await authority.sign({ message: new Uint8Array([2]), tuple });
    } catch (error) {
      prototypeError = error;
    }
  } finally {
    delete Object.prototype[tuple];
  }
  assert.equal(prototypeError?.code, "E_CONTINUITY_RUNTIME");
  await assert.rejects(
    authority.sign({ message: new Uint8Array([2]), tuple }),
    (error) => error.code === "E_CONTINUITY_EQUIVOCATION"
  );
  const document = JSON.parse(await readFile(authorityPath, "utf8"));
  assert.equal(document.sign_once[tuple], encodeBase64Url(new Uint8Array([1])));
});

test("create owns resource bytes and signer capability before the first await", async () => {
  const inner = await createContinuityAuthority();
  const resource = runtimeResource(70_001);
  const expected = new Uint8Array(resource);
  let release;
  let entered;
  const observed = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const authority = {
    custodian: inner.custodian,
    async sign(request) {
      entered();
      await gate;
      return inner.sign(request);
    }
  };
  const creating = createContinuity({ authority, resourceBytes: resource, transitionId: "ownership" });
  await observed;
  resource.fill(255);
  authority.sign = async () => { throw new Error("borrowed method reached"); };
  release();
  const created = await creating;
  assert.deepEqual(
    recoverContinuity({
      authority: inner,
      copies: created.copies,
      expectedHeadHash: created.head_hash,
      quorum: 2
    }).resource_bytes,
    expected
  );
});

test("signed-copy quorum rejects duplicate identity under hostile Set and Array prototypes", async () => {
  const fixture = await transferred(runtimeResource(32_769));
  const setHas = Set.prototype.has;
  const setAdd = Set.prototype.add;
  const arrayMap = Array.prototype.map;
  const arraySome = Array.prototype.some;
  let caught = null;
  try {
    Set.prototype.has = () => false;
    Set.prototype.add = function poisonedSetAdd() { return this; };
    Array.prototype.map = function poisonedArrayMap() { return [this[0], this[0]]; };
    Array.prototype.some = () => false;
    try {
      recoverContinuity({
        authority: fixture.authorityB,
        copies: [fixture.handed.copies[0], fixture.handed.copies[0]],
        expectedHeadHash: fixture.handed.head_hash,
        quorum: 2
      });
    } catch (error) {
      caught = error;
    }
  } finally {
    Set.prototype.has = setHas;
    Set.prototype.add = setAdd;
    Array.prototype.map = arrayMap;
    Array.prototype.some = arraySome;
  }
  assert.equal(caught?.code, "E_CONTINUITY_RUNTIME");
});

test("browser authority sign-once survives transient Map prototype replacement", async () => {
  const inner = await createContinuityAuthority();
  const mapGet = Map.prototype.get;
  const mapSet = Map.prototype.set;
  const authority = Object.freeze({
    custodian: inner.custodian,
    async sign(request) {
      Map.prototype.get = () => undefined;
      Map.prototype.set = function poisonedMapSet() { return this; };
      try {
        return inner.sign(request);
      } finally {
        Map.prototype.get = mapGet;
        Map.prototype.set = mapSet;
      }
    }
  });
  const created = await createContinuity({
    authority,
    resourceBytes: runtimeResource(32_769),
    transitionId: "map-prototype-create"
  });
  const left = await continueContinuity({
    authority,
    capsuleBytes: created.capsule_bytes,
    expectedHeadHash: created.head_hash,
    transitionId: "map-prototype-left"
  });
  assert.equal(left.sequence, "2");
  await assert.rejects(
    continueContinuity({
      authority,
      capsuleBytes: created.capsule_bytes,
      expectedHeadHash: created.head_hash,
      transitionId: "map-prototype-right"
    }),
    (error) => error.code === "E_CONTINUITY_EQUIVOCATION"
  );
});
