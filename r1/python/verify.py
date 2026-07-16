#!/usr/bin/env python3
"""Independent MortalOS R1 golden verifier.

This implementation does not import, execute, translate, or shell out to the
JavaScript reference implementation.  It consumes only canonical R1 bytes and uses
Python's standard library plus cryptography's RFC 8032 verifier.
"""

from __future__ import annotations

import base64
import hashlib
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


OP_FORMAT = "mortalos-r1-operation/1"
RESULT_FORMAT = "mortalos-r1-result/1"
DOMAINS = {
    "GENESIS_ID": b"MORTALOS/V0/GENESIS-ID\0",
    "GENESIS_APPROVAL": b"MORTALOS/V0/GENESIS-APPROVAL\0",
    "PULSE_ID": b"MORTALOS/V0/PULSE-ID\0",
    "PULSE_APPROVAL": b"MORTALOS/V0/PULSE-APPROVAL\0",
    "CUSTODY_ACCEPTANCE": b"MORTALOS/V0/CUSTODY-ACCEPTANCE\0",
    "CUSTODY_COMMITMENT": b"MORTALOS/V0/CUSTODY-COMMITMENT\0",
    "EVENT_PAYLOAD": b"MORTALOS/V0/EVENT-PAYLOAD\0",
    "PEER_ID": b"MORTALOS/V0/PEER-ID\0",
}


class R1Failure(Exception):
    def __init__(self, code: str, detail: str):
        super().__init__(detail)
        self.code = code
        self.detail = detail


def b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def b64d(value: str) -> bytes:
    if not isinstance(value, str) or "=" in value:
        raise R1Failure("R1_SCHEMA", "base64url")
    try:
        raw = base64.urlsafe_b64decode(value + "=" * ((4 - len(value) % 4) % 4))
    except Exception as exc:
        raise R1Failure("R1_SCHEMA", "base64url") from exc
    if b64e(raw) != value:
        raise R1Failure("R1_SCHEMA", "base64url")
    return raw


def canonical(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def no_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise R1Failure("R1_PARSE", "duplicate-key")
        result[key] = value
    return result


def parse_canonical(raw: bytes, detail: str) -> Any:
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=no_duplicates)
    except R1Failure:
        raise
    except Exception as exc:
        raise R1Failure("R1_PARSE", detail) from exc
    if canonical(value) != raw:
        raise R1Failure("R1_CANONICAL", detail)
    return value


def tagged_hash(prefix: str, domain: bytes, message: bytes) -> str:
    return prefix + b64e(hashlib.sha256(domain + message).digest())


def tagged_raw(value: str, prefix: str, size: int) -> bytes:
    if not isinstance(value, str) or not value.startswith(prefix):
        raise ValueError(prefix)
    raw = b64d(value[len(prefix):])
    if len(raw) != size:
        raise ValueError(prefix)
    return raw


def peer_id(public_key: str) -> str:
    raw = tagged_raw(public_key, "ed25519:", 32)
    return tagged_hash("peer:", DOMAINS["PEER_ID"], raw)


def verify(public_key: str, message: bytes, signature: str) -> bool:
    try:
        key = Ed25519PublicKey.from_public_bytes(tagged_raw(public_key, "ed25519:", 32))
        key.verify(tagged_raw(signature, "ed25519:", 64), message)
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False


def require_keys(value: Any, expected: set[str], detail: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected:
        raise R1Failure("R1_SCHEMA", detail + ":keys")
    return value


def artifact(value: str, detail: str) -> bytes:
    if not isinstance(value, str):
        raise R1Failure("R1_SCHEMA", detail)
    try:
        return b64d(value)
    except R1Failure as exc:
        raise R1Failure(exc.code, detail + ":base64url") from exc


def descriptor(custodians: list[dict[str, str]], quorum: dict[str, Any]) -> dict[str, Any]:
    return {"custodians": custodians, "quorum": quorum}


def validate_custody(custodians: Any, quorum: Any) -> tuple[list[dict[str, str]], dict[str, Any]]:
    if not isinstance(custodians, list) or not 1 <= len(custodians) <= 16:
        raise R1Failure("E_CUSTODY_SIZE", "/custodians")
    if not isinstance(quorum, dict) or set(quorum) != {"type", "threshold"}:
        raise R1Failure("E_QUORUM_TYPE", "/quorum")
    threshold = quorum.get("threshold")
    if quorum.get("type") != "threshold" or not isinstance(threshold, int):
        raise R1Failure("E_QUORUM_TYPE", "/quorum")
    if threshold <= len(custodians) // 2 or threshold > len(custodians):
        raise R1Failure("E_QUORUM_THRESHOLD", "/quorum/threshold")
    ids: list[str] = []
    for entry in custodians:
        require_keys(entry, {"key_id", "public_key"}, "/custodians")
        if peer_id(entry["public_key"]) != entry["key_id"]:
            raise R1Failure("E_KEY_ID_MISMATCH", "/custodians")
        ids.append(entry["key_id"])
    if ids != sorted(ids) or len(set(ids)) != len(ids):
        raise R1Failure("E_ARRAY_ORDER", "/custodians")
    return custodians, quorum


def rejection(code: str, field_path: str = "", deterministic_detail: str = "") -> dict[str, Any]:
    return {
        "code": code,
        "deterministic_detail": deterministic_detail,
        "field_path": field_path,
        "status": "reject",
    }


@dataclass
class Accepted:
    public: dict[str, Any]
    custodians: list[dict[str, str]]
    quorum: dict[str, Any]


def validate_genesis(raw: bytes) -> Accepted | dict[str, Any]:
    try:
        envelope = parse_canonical(raw, "envelope")
        require_keys(envelope, {"kind", "body", "approvals"}, "/")
        body = require_keys(
            envelope["body"],
            {
                "protocol_version", "hash_algorithm", "signature_algorithm",
                "genome_hash", "initial_state_root", "initial_custodians",
                "initial_quorum", "nonce",
            },
            "/body",
        )
        if envelope["kind"] != "mortalos.genesis":
            return rejection("E_SCHEMA", "/kind", "mortalos.genesis")
        if body["protocol_version"] != "mortalos/0":
            return rejection("E_VERSION_UNSUPPORTED", "/body/protocol_version", str(body["protocol_version"]))
        custodians, quorum = validate_custody(body["initial_custodians"], body["initial_quorum"])
        approvals = envelope["approvals"]
        if not isinstance(approvals, list) or len(approvals) != len(custodians):
            return rejection("E_GENESIS_APPROVAL_SET", "/approvals", f"{len(approvals) if isinstance(approvals, list) else 0}/{len(custodians)}")
        approval_ids = [entry.get("key_id") for entry in approvals if isinstance(entry, dict)]
        if approval_ids != sorted(approval_ids) or len(set(approval_ids)) != len(approval_ids):
            return rejection("E_APPROVAL_DUPLICATE", "/approvals", "order-or-duplicate")
        body_bytes = canonical(body)
        organism_raw = hashlib.sha256(DOMAINS["GENESIS_ID"] + body_bytes).digest()
        organism_id = "mortalos:" + b64e(organism_raw)
        message = hashlib.sha256(DOMAINS["GENESIS_APPROVAL"] + organism_raw).digest()
        by_id = {entry["key_id"]: entry for entry in custodians}
        for index, approval in enumerate(approvals):
            if not isinstance(approval, dict) or set(approval) != {"key_id", "signature"}:
                return rejection("E_SCHEMA", f"/approvals/{index}", "shape")
            custodian = by_id.get(approval["key_id"])
            if not custodian or not verify(custodian["public_key"], message, approval["signature"]):
                return rejection("E_APPROVAL_SIGNATURE_INVALID", f"/approvals/{index}/signature", approval["key_id"])
        public = {
            "custodian_key_ids": sorted(by_id),
            "genome_hash": body["genome_hash"],
            "kind": "genesis",
            "next_state_root": body["initial_state_root"],
            "object_hash": "sha256:" + b64e(organism_raw),
            "organism_id": organism_id,
            "sequence": "0",
            "status": "accept",
            "threshold": quorum["threshold"],
        }
        return Accepted(public, custodians, quorum)
    except R1Failure as exc:
        return rejection(exc.code, "", exc.detail)


def validate_pulse(raw_envelope: bytes, raw_payload: bytes, parent: Accepted) -> Accepted | dict[str, Any]:
    try:
        envelope = parse_canonical(raw_envelope, "envelope")
        payload = parse_canonical(raw_payload, "event_payload")
        require_keys(envelope, {"kind", "body", "approvals", "acceptances"}, "/")
        body = require_keys(
            envelope["body"],
            {
                "protocol_version", "organism_id", "sequence", "parent_hash",
                "genome_hash", "current_custody_hash", "state_root", "event",
                "next_custodians", "next_quorum",
            },
            "/body",
        )
        if envelope["kind"] != "mortalos.pulse":
            return rejection("E_SCHEMA", "/kind", "mortalos.pulse")
        next_custodians, next_quorum = validate_custody(body["next_custodians"], body["next_quorum"])
        if body["protocol_version"] != "mortalos/0":
            return rejection("E_VERSION_UNSUPPORTED", "/body/protocol_version", str(body["protocol_version"]))
        if body["organism_id"] != parent.public["organism_id"]:
            return rejection("E_ORGANISM_ID_MISMATCH", "/body/organism_id", body["organism_id"])
        if body["parent_hash"] != parent.public["object_hash"]:
            return rejection("E_PARENT_HASH_MISMATCH", "/body/parent_hash", body["parent_hash"])
        if int(body["sequence"]) != int(parent.public["sequence"]) + 1:
            return rejection("E_SEQUENCE_NON_MONOTONIC", "/body/sequence", body["sequence"])
        if body["genome_hash"] != parent.public["genome_hash"]:
            return rejection("E_GENOME_HASH_MISMATCH", "/body/genome_hash", body["genome_hash"])
        expected_current = tagged_hash(
            "sha256:", DOMAINS["CUSTODY_COMMITMENT"], canonical(descriptor(parent.custodians, parent.quorum))
        )
        if body["current_custody_hash"] != expected_current:
            return rejection("E_CURRENT_CUSTODY_HASH_MISMATCH", "/body/current_custody_hash", body["current_custody_hash"])
        expected_payload = tagged_hash("sha256:", DOMAINS["EVENT_PAYLOAD"], canonical(payload))
        if body.get("event", {}).get("payload_hash") != expected_payload:
            return rejection("E_EVENT_PAYLOAD_HASH_MISMATCH", "/body/event/payload_hash", expected_payload)
        body_raw = canonical(body)
        pulse_raw = hashlib.sha256(DOMAINS["PULSE_ID"] + body_raw).digest()
        pulse_hash = "sha256:" + b64e(pulse_raw)
        approval_message = hashlib.sha256(DOMAINS["PULSE_APPROVAL"] + pulse_raw).digest()
        acceptance_message = hashlib.sha256(DOMAINS["CUSTODY_ACCEPTANCE"] + pulse_raw).digest()
        current_by_id = {entry["key_id"]: entry for entry in parent.custodians}
        next_by_id = {entry["key_id"]: entry for entry in next_custodians}
        approvals = envelope["approvals"]
        acceptances = envelope["acceptances"]
        if not isinstance(approvals, list) or len(approvals) < parent.quorum["threshold"]:
            return rejection("E_APPROVAL_INSUFFICIENT_QUORUM", "/approvals", f"{len(approvals) if isinstance(approvals, list) else 0}/{parent.quorum['threshold']}")
        approval_ids: list[str] = []
        for index, approval in enumerate(approvals):
            custodian = current_by_id.get(approval.get("key_id") if isinstance(approval, dict) else None)
            if not custodian or not verify(custodian["public_key"], approval_message, approval.get("signature", "")):
                return rejection("E_APPROVAL_SIGNATURE_INVALID", f"/approvals/{index}/signature", approval.get("key_id", ""))
            approval_ids.append(approval["key_id"])
        if approval_ids != sorted(approval_ids) or len(set(approval_ids)) != len(approval_ids):
            return rejection("E_APPROVAL_DUPLICATE", "/approvals", "order-or-duplicate")
        acceptance_ids: list[str] = []
        for index, acceptance in enumerate(acceptances):
            custodian = next_by_id.get(acceptance.get("key_id") if isinstance(acceptance, dict) else None)
            if not custodian or not verify(custodian["public_key"], acceptance_message, acceptance.get("signature", "")):
                return rejection("E_ACCEPTANCE_SIGNATURE_INVALID", f"/acceptances/{index}/signature", acceptance.get("key_id", ""))
            acceptance_ids.append(acceptance["key_id"])
        if acceptance_ids != sorted(acceptance_ids) or len(set(acceptance_ids)) != len(acceptance_ids):
            return rejection("E_ACCEPTANCE_DUPLICATE", "/acceptances", "order-or-duplicate")
        activation = (set(approval_ids) | set(acceptance_ids)) & set(next_by_id)
        if len(activation) < next_quorum["threshold"]:
            return rejection("E_ACCEPTANCE_INSUFFICIENT", "/acceptances", f"{len(activation)}/{next_quorum['threshold']}")
        public = {
            "custodian_key_ids": sorted(next_by_id),
            "genome_hash": body["genome_hash"],
            "kind": "pulse",
            "next_state_root": body["state_root"],
            "object_hash": pulse_hash,
            "organism_id": body["organism_id"],
            "parent_hash": body["parent_hash"],
            "sequence": body["sequence"],
            "status": "accept",
            "threshold": next_quorum["threshold"],
        }
        return Accepted(public, next_custodians, next_quorum)
    except (R1Failure, ValueError, TypeError) as exc:
        if isinstance(exc, R1Failure):
            return rejection(exc.code, "", exc.detail)
        return rejection("E_VALIDATOR_INTERNAL", "", "python-independent-verifier")


def decode_record(record: Any) -> tuple[bytes, bytes]:
    require_keys(record, {"envelope", "payload"}, "/history")
    return artifact(record["envelope"], "/history/envelope"), artifact(record["payload"], "/history/payload")


def replay(operation: dict[str, Any]) -> tuple[dict[str, Any], Accepted | None]:
    genesis = validate_genesis(artifact(operation["genesis_envelope"], "/genesis_envelope"))
    if not isinstance(genesis, Accepted):
        return {"status": "genesis_rejected", "genesis": genesis}, None
    accepted: dict[str, Accepted] = {genesis.public["object_hash"]: genesis}
    head = genesis
    steps: list[dict[str, Any]] = []
    terminal: dict[str, Any] | None = None
    for record in operation["history"]:
        envelope_raw, payload_raw = decode_record(record)
        envelope = parse_canonical(envelope_raw, "envelope")
        object_hash = tagged_hash("sha256:", DOMAINS["PULSE_ID"], canonical(envelope["body"]))
        if object_hash in accepted:
            terminal = rejection("E_REPLAY_STALE", "/body", object_hash)
            steps.append(terminal)
            break
        result = validate_pulse(envelope_raw, payload_raw, head)
        if not isinstance(result, Accepted):
            terminal = result
            steps.append(result)
            break
        accepted[result.public["object_hash"]] = result
        head = result
        steps.append(result.public)
    snapshot = {
        "accepted_objects": len(accepted),
        "fork_points": [],
        "genesis_hash": genesis.public["object_hash"],
        "head_hash": head.public["object_hash"],
        "organism_id": genesis.public["organism_id"],
        "status": "linear",
    }
    return {
        "snapshot": snapshot,
        "status": "terminated" if terminal else "complete",
        "steps": steps,
        "terminal": terminal,
    }, head


def outcome(operation: dict[str, Any]) -> dict[str, Any]:
    name = operation.get("operation")
    if name == "validate_genesis":
        require_keys(operation, {"format", "genesis_envelope", "operation"}, "/")
        result = validate_genesis(artifact(operation["genesis_envelope"], "/genesis_envelope"))
        return result.public if isinstance(result, Accepted) else result
    if name == "replay_lineage":
        require_keys(operation, {"format", "genesis_envelope", "history", "operation"}, "/")
        replayed, _ = replay(operation)
        return replayed
    if name == "evaluate_mortality":
        require_keys(operation, {"format", "genesis_envelope", "history", "observation", "operation"}, "/")
        replayed, head = replay(operation)
        if head is None or replayed["status"] != "complete":
            return {"status": "history_terminated", "terminal": replayed.get("terminal"), "snapshot": replayed.get("snapshot")}
        observation = require_keys(
            operation["observation"],
            {"authority_loss_irreversible", "latent_evidence_complete", "pending", "state_available", "usable_key_ids"},
            "/observation",
        )
        if observation["pending"]:
            raise R1Failure("R1_SCHEMA", "/observation/pending:python-corpus-profile")
        usable = len(set(observation["usable_key_ids"]) & set(head.public["custodian_key_ids"]))
        threshold = head.public["threshold"]
        authority_viable = usable >= threshold
        state_viable = bool(observation["state_available"])
        if authority_viable:
            status = "alive" if state_viable else "state_stalled"
        elif observation["authority_loss_irreversible"] and observation["latent_evidence_complete"]:
            status = "dead_under_v0_assumptions"
        else:
            status = "authority_unavailable_not_proven_dead"
        mortality = {
            "authority_viable": authority_viable,
            "latent_evidence_complete": observation["latent_evidence_complete"],
            "latent_successors": 0,
            "state_viable": state_viable,
            "status": status,
            "threshold": threshold,
            "usable_keys": usable,
        }
        return {"mortality": mortality, "snapshot": replayed["snapshot"], "status": "complete"}
    raise R1Failure("R1_OPERATION", "/operation")


def execute(raw: bytes) -> bytes:
    operation_name: str | None = None
    try:
        operation = parse_canonical(raw, "operation")
        if not isinstance(operation, dict):
            raise R1Failure("R1_SCHEMA", "/")
        operation_name = operation.get("operation") if isinstance(operation.get("operation"), str) else None
        if operation.get("format") != OP_FORMAT:
            raise R1Failure("R1_VERSION", "/format")
        result = outcome(operation)
    except R1Failure as exc:
        result = {"code": exc.code, "detail": exc.detail, "status": "reject"}
    envelope = {
        "format": RESULT_FORMAT,
        "operation": operation_name,
        "operation_hash": "sha256:" + b64e(hashlib.sha256(raw).digest()),
        "outcome": result,
    }
    return canonical(envelope)


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: verify.py <r1-corpus.json>", file=sys.stderr)
        return 2
    corpus = json.loads(Path(sys.argv[1]).read_text("utf-8"))
    if corpus.get("format") != "mortalos-r1-corpus/1":
        print("unsupported corpus", file=sys.stderr)
        return 1
    for entry in corpus.get("entries", []):
        raw = b64d(entry["operation"])
        actual = b64e(execute(raw))
        if actual != entry["result"]:
            expected_text = b64d(entry["result"]).decode("utf-8")
            actual_text = execute(raw).decode("utf-8")
            print(f"R1 mismatch {entry['id']}\nexpected={expected_text}\nactual={actual_text}", file=sys.stderr)
            return 1
    print(f"MortalOS independent Python R1 verifier: PASS ({len(corpus['entries'])} records)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

