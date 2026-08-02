#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  PROTOCOL_PROFILE,
  recoverContinuityCapsuleQuorum,
  verifyContinuityCapsule
} from "../sdk/index.mjs";
import {
  continueContinuity,
  createContinuity,
  handoffContinuity,
  inspectContinuity,
  recoverContinuity
} from "../sdk/continuity.mjs";
import { canonicalBytes, parseJsonBytes } from "../src/index.mjs";
import { loadNodeAuthority } from "./node-authority.mjs";

function usage() {
  return [
    "Usage:",
    "  mortalos profile",
    "  mortalos capsule verify <file>",
    "  mortalos custody verify <quorum> <file...>",
    "  mortalos create --resource <file> --authority <file> --out <capsule> --copies <dir>",
    "  mortalos inspect --capsule <file>",
    "  mortalos handoff request --capsule <file> --authority <B.key> --out <request.json>",
    "  mortalos handoff propose --capsule <file> --authority <A.key> --request <request.json> --out <proposal.json>",
    "  mortalos handoff accept --capsule <file> --authority <B.key> --proposal <proposal.json> --out <capsule> --copies <dir>",
    "  mortalos recover --authority <B.key> --expected-head <hash> --out-resource <file> --copy <file> --copy <file> [--copy <file>]",
    "  mortalos continue --authority <B.key> --capsule <file> --expected-head <hash> --resource <file> --out <capsule> --copies <dir>"
  ].join("\n");
}

function options(argv) {
  const result = { _: [], copy: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      result._.push(token);
      continue;
    }
    const name = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`missing --${name} value`);
    index += 1;
    if (name === "copy") result.copy.push(value);
    else result[name] = value;
  }
  return result;
}

function requireOption(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`--${label} is required`);
  return resolve(value);
}

function requireTextOption(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`--${label} is required`);
  return value;
}

async function writeArtifact(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

async function writeCopies(directory, copies) {
  await mkdir(directory, { recursive: true });
  const paths = [];
  for (let index = 0; index < copies.length; index += 1) {
    const path = join(directory, `copy-${index + 1}.mosc`);
    await writeFile(path, copies[index]);
    paths.push(path);
  }
  return paths;
}

function publicResult(result, extra = {}) {
  return {
    capsule_id: result.capsule_id,
    head_hash: result.head_hash,
    organism_id: result.organism_id,
    resource_root: result.resource_root,
    resource_size: result.resource_size,
    sequence: result.sequence,
    state_root: result.state_root,
    status: result.status,
    ...extra
  };
}

async function main(argv) {
  if (argv.length === 1 && argv[0] === "profile") {
    process.stdout.write(`${JSON.stringify(PROTOCOL_PROFILE, null, 2)}\n`);
    return 0;
  }
  if (argv.length === 3 && argv[0] === "capsule" && argv[1] === "verify") {
    const result = verifyContinuityCapsule(new Uint8Array(await readFile(argv[2])));
    process.stdout.write(`${JSON.stringify({
      capsule_id: result.capsule_id,
      head_hash: result.head_hash,
      organism_id: result.organism_id,
      state_root: result.state_root,
      status: result.status
    })}\n`);
    return 0;
  }
  if (argv.length >= 5 && argv[0] === "custody" && argv[1] === "verify") {
    const quorum = Number(argv[2]);
    const copies = await Promise.all(argv.slice(3).map(async (file) =>
      new Uint8Array(await readFile(file))));
    const result = recoverContinuityCapsuleQuorum({ copies, quorum });
    process.stdout.write(`${JSON.stringify({
      capsule_id: result.capsule_id,
      rejected_copies: result.rejected.length,
      status: result.status,
      valid_copies: result.valid_copies
    })}\n`);
    return 0;
  }

  const command = argv[0];
  const parsed = options(argv.slice(1));
  if (command === "create") {
    const authorityPath = requireOption(parsed.authority, "authority");
    const authority = await loadNodeAuthority(authorityPath, { create: true });
    const created = await createContinuity({
      authority,
      resourceBytes: new Uint8Array(await readFile(requireOption(parsed.resource, "resource"))),
      transitionId: parsed["transition-id"] ?? "cli-create"
    });
    const out = requireOption(parsed.out, "out");
    await writeArtifact(out, created.capsule_bytes);
    const copies = await writeCopies(requireOption(parsed.copies, "copies"), created.copies);
    process.stdout.write(`${JSON.stringify(publicResult(created, { authority: authority.custodian, capsule: out, copies }))}\n`);
    return 0;
  }
  if (command === "inspect") {
    const inspected = inspectContinuity({
      capsuleBytes: new Uint8Array(await readFile(requireOption(parsed.capsule, "capsule")))
    });
    process.stdout.write(`${JSON.stringify(inspected)}\n`);
    return 0;
  }
  if (command === "handoff" && parsed._[0] === "request") {
    const authority = await loadNodeAuthority(requireOption(parsed.authority, "authority"), { create: true });
    const request = await handoffContinuity({
      authority,
      capsuleBytes: new Uint8Array(await readFile(requireOption(parsed.capsule, "capsule"))),
      phase: "request"
    });
    const out = requireOption(parsed.out, "out");
    await writeArtifact(out, canonicalBytes(request));
    process.stdout.write(`${JSON.stringify({ authority: authority.custodian, out, status: "handoff-requested" })}\n`);
    return 0;
  }
  if (command === "handoff" && parsed._[0] === "propose") {
    const authority = await loadNodeAuthority(requireOption(parsed.authority, "authority"));
    const proposal = await handoffContinuity({
      authority,
      capsuleBytes: new Uint8Array(await readFile(requireOption(parsed.capsule, "capsule"))),
      phase: "propose",
      request: parseJsonBytes(await readFile(requireOption(parsed.request, "request")))
    });
    const out = requireOption(parsed.out, "out");
    await writeArtifact(out, canonicalBytes(proposal));
    process.stdout.write(`${JSON.stringify({ out, status: "handoff-proposed" })}\n`);
    return 0;
  }
  if (command === "handoff" && parsed._[0] === "accept") {
    const authority = await loadNodeAuthority(requireOption(parsed.authority, "authority"));
    const accepted = await handoffContinuity({
      authority,
      capsuleBytes: new Uint8Array(await readFile(requireOption(parsed.capsule, "capsule"))),
      phase: "accept",
      proposal: parseJsonBytes(await readFile(requireOption(parsed.proposal, "proposal")))
    });
    const out = requireOption(parsed.out, "out");
    await writeArtifact(out, accepted.capsule_bytes);
    const copies = await writeCopies(requireOption(parsed.copies, "copies"), accepted.copies);
    process.stdout.write(`${JSON.stringify(publicResult(accepted, { capsule: out, copies }))}\n`);
    return 0;
  }
  if (command === "recover") {
    const authority = await loadNodeAuthority(requireOption(parsed.authority, "authority"));
    if (parsed.copy.length < 1) throw new Error("at least one --copy is required");
    const recovered = recoverContinuity({
      authority,
      copies: await Promise.all(parsed.copy.map(async (path) => new Uint8Array(await readFile(path)))),
      expectedHeadHash: requireTextOption(parsed["expected-head"], "expected-head"),
      quorum: PROTOCOL_PROFILE.continuity.signed_copy_quorum
    });
    const resource = requireOption(parsed["out-resource"], "out-resource");
    await writeArtifact(resource, recovered.resource_bytes);
    process.stdout.write(`${JSON.stringify({
      capsule_id: recovered.capsule_id,
      head_hash: recovered.head_hash,
      organism_id: recovered.organism_id,
      out_resource: resource,
      rejected_copies: recovered.rejected_copies.length,
      resource_root: recovered.resource_root,
      sequence: recovered.sequence,
      status: recovered.status,
      valid_copies: recovered.valid_copies
    })}\n`);
    return 0;
  }
  if (command === "continue") {
    const authority = await loadNodeAuthority(requireOption(parsed.authority, "authority"));
    const continued = await continueContinuity({
      authority,
      capsuleBytes: new Uint8Array(await readFile(requireOption(parsed.capsule, "capsule"))),
      expectedHeadHash: requireTextOption(parsed["expected-head"], "expected-head"),
      resourceBytes: new Uint8Array(await readFile(requireOption(parsed.resource, "resource"))),
      transitionId: parsed["transition-id"] ?? "cli-continue"
    });
    const out = requireOption(parsed.out, "out");
    await writeArtifact(out, continued.capsule_bytes);
    const copies = await writeCopies(requireOption(parsed.copies, "copies"), continued.copies);
    process.stdout.write(`${JSON.stringify(publicResult(continued, { capsule: out, copies }))}\n`);
    return 0;
  }
  process.stderr.write(`${usage()}\n`);
  return 2;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_CLI",
    detail: String(error?.message ?? error),
    status: "rejected"
  })}\n`);
  process.exitCode = 1;
}
