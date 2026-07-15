## Agent identity

<!-- Keep the following labels exact; Agent PR Policy parses them. -->
Author-Agent: replace-me
Reviewer-Agent: reviewer-merge-gate
Base-Commit: replace-with-current-40-character-main-sha

## Scope

<!-- Replace with exact files or non-root directory/** prefixes; remove this item. -->
Shared-Paths:
- replace-me

Summary:
- replace-me

## Verification

Validation:
- replace-me — PASS

## Risk

Risk: replace-me

North-Star-Impact: replace-me

## Reviewer handoff

- [ ] The branch is `agent/<author-agent>--<task>` and was created from current `main`.
- [ ] Shared-path intent is recorded in the author's `HANDOFF.md`.
- [ ] `Shared-Paths` covers every changed path exactly or by a non-root `/**` prefix.
- [ ] No unrelated files, credentials, generated dependencies, or disposable logs are included.
- [ ] The PR is ready for immutable-head review by `reviewer-merge-gate`.
