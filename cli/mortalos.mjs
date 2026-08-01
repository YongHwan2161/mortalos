#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import {
  PROTOCOL_PROFILE,
  recoverContinuityCapsuleQuorum,
  verifyContinuityCapsule
} from "../sdk/index.mjs";

function usage() {
  return "Usage: mortalos profile | capsule verify <file> | custody verify <quorum> <file...>";
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
  process.stderr.write(`${usage()}\n`);
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
