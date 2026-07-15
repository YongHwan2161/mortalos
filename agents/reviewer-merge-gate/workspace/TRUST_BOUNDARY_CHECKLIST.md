# Reviewer trust-boundary checklist

Use this checklist in addition to the mandatory sequence in `../README.md`.

## Policy and identity

- Capture base and head as full immutable SHAs.
- Confirm the author is registered and differs from the reviewer agent.
- Confirm policy code and workflow configuration come from the trusted base.
- Reject any policy job that checks out, imports, or executes proposed-head code.
- Treat same-account reviewer separation as logical, not account-level.

## Scope and evidence

- Match every changed path to a declared shared path.
- Read generated and workflow changes as executable code, not documentation.
- Reproduce the highest-risk claim independently; do not rely only on author output.
- Distinguish protocol rejection from local verifier failure or missing evidence.
- Check that documentation claims do not exceed tests or enforcement.

## Decision and merge

- Re-fetch PR metadata, comments, threads, checks, base, and head before deciding.
- Restart if the head or relevant base changed.
- Record blocking findings against the exact SHA.
- Merge only the reviewed SHA with an expected-head guard.
- Verify the resulting `main` SHA and its post-merge checks.
