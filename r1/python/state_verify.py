#!/usr/bin/env python3
"""Independent MortalOS state/1 golden verifier."""

import base64
import hashlib
import json
import sys
from pathlib import Path

STATE_DOMAIN = b"MORTALOS/STATE/1/STATE\0"
INPUT_DOMAIN = b"MORTALOS/STATE/1/INPUT\0"
GENOME_DOMAIN = b"MORTALOS/STATE/1/GENOME\0"


def b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def b64d(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * ((4 - len(value) % 4) % 4))


def canonical(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def digest(domain: bytes, raw: bytes) -> str:
    return "sha256:" + b64e(hashlib.sha256(domain + raw).digest())


def transition(genome_raw: bytes, state_raw: bytes, input_raw: bytes):
    genome = json.loads(genome_raw)
    state = json.loads(state_raw)
    request = json.loads(input_raw)
    if canonical(genome) != genome_raw or genome != {"engine": "mortalos-state/1", "genome": "pulse-seed-v1"}:
        raise ValueError("genome")
    if canonical(state) != state_raw or set(state) != {"avatar_seed", "format", "pulse_count"}:
        raise ValueError("state")
    if canonical(request) != input_raw or set(request) != {"action", "format", "steps"}:
        raise ValueError("input")
    if state["format"] != "mortalos-state/1" or request["format"] != "mortalos-state-input/1" or request["action"] != "nurture":
        raise ValueError("version")
    if not isinstance(request["steps"], int) or not 1 <= request["steps"] <= 100:
        raise ValueError("steps")
    next_state = canonical({
        "avatar_seed": state["avatar_seed"],
        "format": "mortalos-state/1",
        "pulse_count": state["pulse_count"] + request["steps"],
    })
    receipt = canonical({
        "engine_version": "mortalos-state/1",
        "format": "mortalos-state-receipt/1",
        "genome_hash": digest(GENOME_DOMAIN, genome_raw),
        "input_hash": digest(INPUT_DOMAIN, input_raw),
        "next_state_hash": digest(STATE_DOMAIN, next_state),
        "prior_state_hash": digest(STATE_DOMAIN, state_raw),
        "step_count": request["steps"],
    })
    return next_state, receipt


def main() -> int:
    if len(sys.argv) != 2:
        return 2
    corpus = json.loads(Path(sys.argv[1]).read_text("utf-8"))
    if corpus.get("format") != "mortalos-state-corpus/1":
        return 1
    for entry in corpus["entries"]:
        state, receipt = transition(
            b64d(entry["genome_base64url"]),
            b64d(entry["state_base64url"]),
            b64d(entry["input_base64url"]),
        )
        if b64e(state) != entry["next_state_base64url"] or b64e(receipt) != entry["receipt_base64url"]:
            print(f"state mismatch: {entry['id']}", file=sys.stderr)
            return 1
    print(f"MortalOS independent Python state verifier: PASS ({len(corpus['entries'])} records)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
