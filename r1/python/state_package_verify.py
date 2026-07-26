#!/usr/bin/env python3
"""Independent MortalOS state-package/1 golden verifier."""

import base64
import hashlib
import json
import sys
from pathlib import Path

CHUNK_BYTES = 65_536
MAX_RESOURCE_BYTES = 4_194_304
REFERENCE_BYTES = 1_048_576
CHUNK_DOMAIN = b"MORTALOS/STATE-PACKAGE/1/CHUNK\0"
INPUT_DOMAIN = b"MORTALOS/STATE-PACKAGE/1/INPUT\0"
RECEIPT_DOMAIN = b"MORTALOS/STATE-PACKAGE/1/RECEIPT\0"
RESOURCE_DOMAIN = b"MORTALOS/STATE-PACKAGE/1/RESOURCE\0"
STATE_DOMAIN = b"MORTALOS/STATE-PACKAGE/1/STATE\0"


def b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def canonical(value) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def digest(domain: bytes, raw: bytes) -> str:
    return "sha256:" + b64e(hashlib.sha256(domain + raw).digest())


def reference_resource() -> bytes:
    return bytes(
        (
            index * 73
            + (index >> 8) * 19
            + (index >> 16) * 37
            + 41
        )
        & 0xFF
        for index in range(REFERENCE_BYTES)
    )


def build(genome_hash: str, prior_state_root: str):
    resource = reference_resource()
    input_raw = canonical(
        {
            "format": "mortalos-state-package-input/1",
            "operation": "replace-resource",
            "transition_id": "reference-1mib",
        }
    )
    chunks = []
    for index, offset in enumerate(range(0, len(resource), CHUNK_BYTES)):
        raw = resource[offset : offset + CHUNK_BYTES]
        chunks.append(
            {
                "digest": digest(CHUNK_DOMAIN, raw),
                "index": index,
                "size": len(raw),
            }
        )
    manifest = {
        "chunk_size": CHUNK_BYTES,
        "chunks": chunks,
        "format": "mortalos-state-package-manifest/1",
        "genome_hash": genome_hash,
        "max_resource_bytes": MAX_RESOURCE_BYTES,
        "next_state_root": "",
        "prior_state_root": prior_state_root,
        "receipt_digest": "",
        "resource_format": "application/octet-stream",
        "resource_root": digest(RESOURCE_DOMAIN, resource),
        "resource_size": len(resource),
        "schema_version": "1",
        "storage_policy": "mortalos-state-recovery-policy/1",
        "transition_input_digest": digest(INPUT_DOMAIN, input_raw),
    }
    state_basis = {
        "chunk_size": manifest["chunk_size"],
        "chunks": manifest["chunks"],
        "format": "mortalos-state-package-state/1",
        "genome_hash": manifest["genome_hash"],
        "max_resource_bytes": manifest["max_resource_bytes"],
        "prior_state_root": manifest["prior_state_root"],
        "resource_format": manifest["resource_format"],
        "resource_root": manifest["resource_root"],
        "resource_size": manifest["resource_size"],
        "schema_version": manifest["schema_version"],
        "storage_policy": manifest["storage_policy"],
        "transition_input_digest": manifest["transition_input_digest"],
    }
    manifest["next_state_root"] = digest(STATE_DOMAIN, canonical(state_basis))
    receipt = {
        "chunk_count": len(chunks),
        "format": "mortalos-state-package-receipt/1",
        "genome_hash": manifest["genome_hash"],
        "next_state_root": manifest["next_state_root"],
        "prior_state_root": manifest["prior_state_root"],
        "resource_root": manifest["resource_root"],
        "resource_size": manifest["resource_size"],
        "storage_policy": manifest["storage_policy"],
        "transition_input_digest": manifest["transition_input_digest"],
    }
    receipt_raw = canonical(receipt)
    manifest["receipt_digest"] = digest(RECEIPT_DOMAIN, receipt_raw)
    return {
        "chunk_digests": [entry["digest"] for entry in chunks],
        "input_base64url": b64e(input_raw),
        "manifest_base64url": b64e(canonical(manifest)),
        "next_state_root": manifest["next_state_root"],
        "receipt_base64url": b64e(receipt_raw),
        "resource_root": manifest["resource_root"],
        "resource_size": len(resource),
    }


def main() -> int:
    if len(sys.argv) != 2:
        return 2
    corpus = json.loads(Path(sys.argv[1]).read_text("utf-8"))
    if corpus.get("format") != "mortalos-state-package-corpus/1":
        return 1
    if len(corpus.get("entries", [])) != 1:
        return 1
    expected = build(corpus["genome_hash"], corpus["prior_state_root"])
    actual = dict(corpus["entries"][0])
    actual.pop("id", None)
    if actual != expected:
        print("state-package corpus mismatch", file=sys.stderr)
        return 1
    print(
        "MortalOS independent Python state-package verifier: PASS "
        f"({expected['resource_size']} bytes / {len(expected['chunk_digests'])} chunks)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
