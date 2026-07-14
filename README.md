# MortalOS

**An ownerless OS that lives across connected browsers—circulating memory, computation, and identity as hosts change, growing with participation, and dying when the network disappears.**

MortalOS is an experiment in hostless digital continuity. It asks whether a network-native entity can:

1. be born without a single owner;
2. preserve one identity while every physical host is replaced;
3. repair its body as peers join and leave; and
4. die when it permanently loses the capability to produce a valid successor state.

The first milestone is intentionally smaller than a general-purpose operating system or distributed AI. We will first prove—or falsify—the lifecycle protocol on which those systems would depend.

## Status

P0 protocol semantics and threat model are complete and verified. P1—the deterministic lifecycle state machine—is next.

## Start here

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the ordered implementation plan, invariants, non-goals, and strict exit criteria for every phase.

P0 specification and evidence:

- [Protocol v0](docs/PROTOCOL.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Rejection codes](docs/REJECTION_CODES.md)
- [Requirements traceability](docs/TRACEABILITY.md)
- [P0 verification report](docs/P0_VERIFICATION_REPORT.md)

## Core principle

> The network does not host MortalOS. The living network is MortalOS.
