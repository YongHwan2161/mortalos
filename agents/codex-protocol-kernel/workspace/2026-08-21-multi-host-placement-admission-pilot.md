# Multi-host placement-admission pilot

Status: **OPERATOR RUNBOOK DRAFT — NO LIVE AUTHORITY OR TOPOLOGY CLAIM**

This runbook moves the existing placement-admission ceremony from one-PC evidence to
separately administered hosts without giving the coordinator any private signing key.
It introduces no new core protocol format. The membership request and individual
custodian approval files are non-normative operator envelopes; the finalized epoch is
the existing authenticated protocol artifact. Every output must be created and
verified by the existing CLIs on one exact reviewed source revision.

## Strict pilot target

Use four separately administered service/observer execution contexts plus every
current Capsule custodian context:

| Role | Private custody | Public output |
| --- | --- | --- |
| issuer signer | issuer administrator and host only | HTTPS identity and signed admission response |
| subject signer | subject administrator and host only | HTTPS identity and signed admission response |
| observer A | observer-A administrator and host only | public observer identity, plan acceptance, attestation |
| observer B | observer-B administrator and host only | public observer identity, plan acceptance, attestation |
| current lineage custodian(s) | each Capsule custodian only | one request-bound epoch approval each |

The coordinator receives public/canonical files only. It must not receive authority
files, admission bearer tokens, possession tokens, TLS private keys, browser profiles,
or remote shell access that
would collapse the claimed administrative separation.
Possession-only tokens move directly from each signer administrator to each planned
observer's private runtime channel and must never enter coordinator files or artifacts.

Two observer keys are the protocol minimum, not proof of independence. Promotion also
needs evidence that the four contexts do not share an administrator, account,
credential store, host, and failure domain. Signed declarations and the final compact
view remain `non_authority:true` for those physical facts.

## Freeze and public input inventory

Before creating any authority or output:

1. Record one exact Git commit and require every operator to verify that commit.
2. Record SHA-256 digests for the current Capsule and every intended subject's policy
   and root configuration. A membership epoch cannot exist before its admission
   ceremonies. Record each trust root, public identity, request, issuer response,
   subject response, ceremony bundle, membership request, approval, and finalized
   epoch immediately after its no-replace publication. Freeze the complete candidate
   chain only after finalization.
3. Allocate separate durable directories for issuer, subject, observer A, and observer
   B. Never copy an authority file between them.
4. Allocate distinct HTTPS origins and TLS custody for issuer and subject. Prefer the
   signer's native HTTPS mode so each administrator supplies its own local certificate
   and private-key paths. A separately administered TLS terminator remains supported by
   omitting the native TLS arguments and binding the signer to a private HTTP address.
5. Set bearer tokens only in each signer process environment. Do not put them in a
   command argument, checked file, readiness output, coordinator bundle, or this
   runbook.
6. Configure each observer process trust store independently. A private CA may be
   supplied through that process's `NODE_EXTRA_CA_CERTS`; sharing one coordinator-owned
   CA or trust store does not demonstrate independent administration.

Any digest drift, missing predecessor, pre-existing output path, or inability to prove
role-local custody is a fresh-ceremony HOLD. Do not overwrite or backfill an artifact
from a failed evidence epoch.

## Phase 1 — Prepare the public signer bootstrap

The issuer host first creates or restores its local authority and publishes only the
canonical public trust root:

```powershell
node scripts/prepare-placement-admission-issuer.mjs `
  --authority <issuer-private-dir>/authority.json `
  --policy <public-input-dir>/policy.json `
  --root-config <public-input-dir>/root-config.json `
  --output <issuer-public-dir>/trust-root.json
```

Transfer only `trust-root.json` to the subject host and coordinator. The trust root is
a real configured protocol authority input, but it contains no issuer private key and
does not prove issuer honesty or topology. The issuer service must reuse the exact same
authority, policy, and root configuration so its readiness trust-root ID equals this
published file.

The subject host creates or restores its own local authority and publishes only its
canonical public identity:

```powershell
node scripts/prepare-placement-admission-subject.mjs `
  --authority <subject-private-dir>/authority.json `
  --output <subject-public-dir>/subject-identity.json
```

Transfer only `subject-identity.json` to the coordinator. The coordinator can now
create the random, endpoint-bound signing request without starting either service or
receiving either private authority:

```powershell
node scripts/create-placement-admission-ceremony-request.mjs `
  --trust-root <received-dir>/trust-root.json `
  --subject-identity <received-dir>/subject-identity.json `
  --policy <public-input-dir>/policy.json `
  --issuer-origin https://issuer.example.invalid `
  --subject-origin https://subject.example.invalid `
  --issued-at-ms <issued-ms> `
  --valid-from-ms <valid-from-ms> `
  --valid-until-ms <valid-until-ms> `
  --output <coordinator-dir>/admission-request.json
```

Freeze the exact trust-root, subject-identity, and request digests now. A repeated or
changed request requires a fresh output path and a fresh ceremony; do not overwrite
the failed epoch's bytes.

## Phase 2 — Start separately custodied signers

Start the issuer service with the exact authority, policy, and root configuration used
for its published trust root:

```powershell
$env:MORTALOS_ADMISSION_SIGNER_TOKEN = '<issuer-secret-from-local-secret-store>'
$env:MORTALOS_ADMISSION_SIGNER_POSSESSION_TOKEN = '<distinct-issuer-proof-secret>'
node scripts/run-placement-admission-signer.mjs `
  --authority <issuer-private-dir>/authority.json `
  --endpoint-origin https://issuer.example.invalid `
  --listen-host 0.0.0.0 `
  --listen-port 443 `
  --policy <public-input-dir>/policy.json `
  --profile-state <issuer-private-dir>/profile.json `
  --role issuer `
  --root-config <public-input-dir>/root-config.json `
  --tls-certificate <issuer-private-dir>/tls-certificate.pem `
  --tls-private-key <issuer-private-dir>/tls-private-key.pem
```

Subject host:

```powershell
$env:MORTALOS_ADMISSION_SIGNER_TOKEN = '<subject-secret-from-local-secret-store>'
$env:MORTALOS_ADMISSION_SIGNER_POSSESSION_TOKEN = '<distinct-subject-proof-secret>'
node scripts/run-placement-admission-signer.mjs `
  --authority <subject-private-dir>/authority.json `
  --endpoint-origin https://subject.example.invalid `
  --listen-host 0.0.0.0 `
  --listen-port 443 `
  --policy <public-input-dir>/policy.json `
  --profile-state <subject-private-dir>/profile.json `
  --role subject `
  --trust-root <received-dir>/trust-root.json `
  --tls-certificate <subject-private-dir>/tls-certificate.pem `
  --tls-private-key <subject-private-dir>/tls-private-key.pem
```

Native TLS requires both files, an `https` advertised origin, bounded regular-file
inputs, a parseable certificate/private-key pair, TLS 1.2 or newer, and a separately
generated `MORTALOS_ADMISSION_SIGNER_POSSESSION_TOKEN` that differs from the admission
bearer. The second token authorizes only bounded TLS-exporter role-key proofs; it cannot
call the admission-signature route. The CLI checks these before it creates an absent
signing authority. Readiness must report `listen_protocol:"https"`, `tls_enabled:true`,
and `key_possession:"tls-exporter-role-key-signed"`; neither TLS key bytes nor either
token may appear in stdout/stderr or public artifacts. If a local private CA is used,
each role-local client and observer configures that CA in its own trust store (for the
Node CLI, `NODE_EXTRA_CA_CERTS`) rather than disabling certificate validation.

The advertised origins must equal the externally reachable HTTPS origins. A
loopback/localhost public alias, redirect, wrong live identity, certificate validation
failure, incomplete/mismatched TLS pair, or profile-origin conflict is a HOLD before
private signing-key use. When a separate TLS terminator is intentionally used, omit
both `--tls-*` arguments, require readiness `listen_protocol:"http"`, bind only a
private address, and preserve the terminator's administrator-local key custody. That
mode cannot provide the native end-to-end exporter; every observer invocation must add
`--key-possession-mode legacy-identity-only`, and the resulting `/1` artifact is an
explicit HOLD rather than fresh role-key-possession evidence.

## Phase 3 — Publish one endpoint-bound ceremony

Transfer the frozen public request to both signer administrators. In a second local
shell on the issuer host, use only the issuer host's bearer value and publish its
token-free role response:

```powershell
$env:MORTALOS_ADMISSION_SIGNER_TOKEN = '<issuer-secret-from-local-secret-store>'
node scripts/run-placement-admission-ceremony-role.mjs `
  --endpoint https://issuer.example.invalid `
  --request <received-dir>/admission-request.json `
  --role issuer `
  --output <issuer-public-dir>/issuer-response.json `
  --timeout-ms 15000
Remove-Item Env:MORTALOS_ADMISSION_SIGNER_TOKEN
```

Subject administrator, using only the subject host's bearer value:

```powershell
$env:MORTALOS_ADMISSION_SIGNER_TOKEN = '<subject-secret-from-local-secret-store>'
node scripts/run-placement-admission-ceremony-role.mjs `
  --endpoint https://subject.example.invalid `
  --request <received-dir>/admission-request.json `
  --role subject `
  --output <subject-public-dir>/subject-response.json `
  --timeout-ms 15000
Remove-Item Env:MORTALOS_ADMISSION_SIGNER_TOKEN
```

Transfer only the two public role-response files to the coordinator. The coordinator
uses no bearer value and performs no network request while finalizing:

```powershell
node scripts/finalize-placement-admission-ceremony.mjs `
  --evaluated-at-ms <logical-evaluation-ms> `
  --issuer-response <received-dir>/issuer-response.json `
  --request <coordinator-dir>/admission-request.json `
  --subject-response <received-dir>/subject-response.json `
  --output <coordinator-dir>/ceremony-bundle.json
```

All three outputs are immutable and token-free. Finalization verifies both live
identity/signature observations against the frozen request and reproduces the exact
offline-verifiable bundle. Changing either origin/key pair requires a fresh ceremony.
The combined `run-placement-admission-ceremony.mjs` remains a same-administrator
compatibility path; it is not the strict independent-administration pilot path because
one process receives both bearer values.

## Phase 4 — Admit each observer through its own ceremony

Run once on each observer host, changing only the host-local directory:

```powershell
node scripts/prepare-placement-admission-deployment-observer.mjs `
  --authority <observer-private-dir>/authority.json `
  --output <observer-public-dir>/observer-identity.json
```

Transfer only `observer-identity.json` to the coordinator. Each observer keeps its
authority file. An existing public output is not overwritten; exact identity recovery
uses a new export path from the same local authority.

An observer identity is not yet an admitted observer. Repeat Phases 1–3 for observer A
and observer B with all of these changes:

- the exact policy role is `["observer"]`;
- `failure_domain_id` and `operator_root_id` equal that observer's declared plan values;
- each policy has a distinct `authority_id`, trust-root ID, signer profile, request,
  and ceremony bundle;
- the observer's existing deployment authority is the subject authority, so the
  admitted subject key is the same key that later accepts the plan and attests;
- the issuer administrator may operate the issuer side, but each differently bound
  policy uses a separate issuer authority file and profile in this pilot.

The expected public outputs are now the provider `ceremony-bundle.json`,
`observer-a-ceremony-bundle.json`, and `observer-b-ceremony-bundle.json`. Directly
constructing observer evidence from private authorities is forbidden: every member
enters the epoch only through a verified bundle.

## Phase 5 — Create and custody-approve the membership epoch

Only after all three bundles exist may the coordinator create the canonical request:

```powershell
node scripts/create-placement-membership-epoch-request.mjs `
  --capsule <public-input-dir>/current-capsule.json `
  --ceremony-bundle <coordinator-dir>/ceremony-bundle.json `
  --ceremony-bundle <coordinator-dir>/observer-a-ceremony-bundle.json `
  --ceremony-bundle <coordinator-dir>/observer-b-ceremony-bundle.json `
  --evaluated-at-ms <logical-evaluation-ms> `
  --expires-at-ms <epoch-expires-ms> `
  --observer-max-faulty 0 `
  --observer-roster-size 2 `
  --observer-threshold 2 `
  --output <coordinator-dir>/membership-request.json
```

This CLI derives the member evidence and trust-root set from the bundles; it does not
accept a free-form parameter document. Send the exact request, Capsule, and predecessor
epoch when applicable to every current Capsule custodian. Each custodian independently
runs:

```powershell
node scripts/approve-placement-membership-epoch.mjs `
  --authority <custodian-private-dir>/authority.json `
  --capsule <received-dir>/current-capsule.json `
  --request <received-dir>/membership-request.json `
  --output <custodian-public-dir>/membership-approval.json
```

The approval CLI will not create an authority, rejects a non-current custodian before
signing, and binds the sign-once journal to the exact derived request. Collect at least
the Capsule's current custody threshold, then finalize in any input order:

```powershell
node scripts/finalize-placement-membership-epoch.mjs `
  --capsule <public-input-dir>/current-capsule.json `
  --request <coordinator-dir>/membership-request.json `
  --approval <received-dir>/custodian-a-approval.json `
  --approval <received-dir>/custodian-b-approval.json `
  --output <coordinator-dir>/epoch-1.json
```

For a successor epoch, add the same `--prior-epoch <epoch-N.json>` argument to request
creation, every approval, and finalization. Mixed-request approvals, an insufficient
quorum, a wrong Capsule, or a missing predecessor produce no epoch. Freeze the exact
complete epoch chain now.

## Phase 6 — Create one plan and collect all acceptances

The coordinator creates canonical `public-assignments.json`:

```json
{"format":"mortalos-placement-admission-deployment-plan-input/1","observers":[{"declared_administration_id":"sha256:<observer-a-admin-digest>","declared_failure_domain_id":"sha256:<observer-a-domain-digest>","declared_vantage_id":"sha256:<observer-a-vantage-digest>","observer":{}},{"declared_administration_id":"sha256:<observer-b-admin-digest>","declared_failure_domain_id":"sha256:<observer-b-domain-digest>","declared_vantage_id":"sha256:<observer-b-vantage-digest>","observer":{}}]}
```

Each `{}` is replaced with the exact canonical public observer identity object. The
digests are declarations approved by each observer when it signs the plan; they are
not self-proving topology facts.

```powershell
node scripts/create-placement-admission-deployment-plan.mjs `
  --assignments <coordinator-dir>/public-assignments.json `
  --bundle <coordinator-dir>/ceremony-bundle.json `
  --issued-at-ms <issued-ms> `
  --not-before-ms <not-before-ms> `
  --expires-at-ms <expires-ms> `
  --timeout-ms 15000 `
  --output <coordinator-dir>/deployment-plan.json
```

Return the exact plan to each observer. Each observer runs:

```powershell
node scripts/accept-placement-admission-deployment-plan.mjs `
  --authority <observer-private-dir>/authority.json `
  --deployment-plan <received-dir>/deployment-plan.json `
  --output <observer-public-dir>/plan-acceptance.json
```

The coordinator must collect the complete roster and activate exactly that plan:

```powershell
node scripts/activate-placement-admission-deployment-plan.mjs `
  --deployment-plan <coordinator-dir>/deployment-plan.json `
  --acceptance <received-dir>/observer-a-acceptance.json `
  --acceptance <received-dir>/observer-b-acceptance.json `
  --output <coordinator-dir>/plan-activation.json
```

A second plan for the same ceremony/key is an equivocation HOLD, not a retry path.

## Phase 7 — Bind the exact current membership view

The coordinator supplies the complete authenticated candidate chain:

```powershell
node scripts/bind-placement-admission-deployment-plan-membership.mjs `
  --activation <coordinator-dir>/plan-activation.json `
  --bundle <coordinator-dir>/ceremony-bundle.json `
  --capsule <public-input-dir>/current-capsule.json `
  --membership-epoch <public-input-dir>/epoch-1.json `
  --output <coordinator-dir>/deployment-plan-membership.json
```

For a rotated chain, add every successor through the selected head. List every
authenticated epoch exactly once. Missing history, a sibling,
cycle, unsafe reconfiguration, extraneous candidate, wrong Capsule, or a selected epoch
whose complete observer roster differs from the plan must halt before observation.

## Phase 8 — Observe and attest from every observer host

Send the exact Capsule, membership binding, and complete candidate chain to every
observer. Each signer administrator supplies the observer a time-bounded possession-
only token through a private runtime channel; never send the admission bearer. Each
observer runs from a fresh process and its own trust store:

```powershell
$env:MORTALOS_ADMISSION_ISSUER_POSSESSION_TOKEN = '<issuer-proof-secret>'
$env:MORTALOS_ADMISSION_SUBJECT_POSSESSION_TOKEN = '<subject-proof-secret>'
node scripts/observe-and-attest-placement-admission-deployment.mjs `
  --attested-at-ms <observer-local-attested-ms> `
  --authority <observer-private-dir>/authority.json `
  --capsule <received-dir>/current-capsule.json `
  --deployment-plan-membership <received-dir>/deployment-plan-membership.json `
  --membership-epoch <received-dir>/epoch-1.json `
  --observed-at-ms <observer-local-observed-ms> `
  --observation-journal <observer-private-dir>/deployment-observation.json `
  --output <observer-public-dir>/deployment-attestation.json
Remove-Item Env:MORTALOS_ADMISSION_ISSUER_POSSESSION_TOKEN
Remove-Item Env:MORTALOS_ADMISSION_SUBJECT_POSSESSION_TOKEN
```

The default is channel-bound `/2`; absent/invalid possession tokens fail before network
access and never downgrade. The signer and observer derive the fixed-label TLS exporter
with the exact canonical challenge as context, and the role key signs its digest. A
captured identity or proof replayed under the same certificate on another TLS connection
must reject. The CLI hard-links the exact bounded token-free observation to
`--observation-journal` before it invokes the durable observer signer. Preserve that
journal under the observer's directory custody. If the process dies after journal or
signer publication but before the attestation output appears, rerun the same command:
the CLI restores the journal and requires neither proof tokens nor reachable signer
endpoints. A missing journal requires a live `/2` probe; a conflicting journal or mode/
time mismatch is a HOLD. Rotate the proof tokens after the observation window or signer
restart.

Only an exact journal-backed retry may reproduce the same attestation; reconnecting
creates another exporter and is a different observation. A different observation,
candidate view, or instant under the same plan must halt. Membership rotation requires new
member ceremonies as applicable, a custody-approved successor epoch, a fresh plan,
complete acceptance/activation, and fresh binding.

## Phase 9 — Publish and independently verify the complete view

Coordinator:

```powershell
node scripts/create-placement-admission-deployment-attestation-view.mjs `
  --attestation <received-dir>/observer-a-attestation.json `
  --attestation <received-dir>/observer-b-attestation.json `
  --output <coordinator-dir>/attestation-view.json
```

Independent verifier process:

```powershell
node scripts/verify-placement-admission-deployment-attestation-view.mjs `
  --view <coordinator-dir>/attestation-view.json `
  --attestation <received-dir>/observer-a-attestation.json `
  --attestation <received-dir>/observer-b-attestation.json
```

Pass requires `attestations_verified:true`, the exact whole roster, and the same view
ID for every independent verifier. Missing, duplicate, substituted, or extra sidecars
must fail; offline restore alone is not verification.

The compact view check above does not by itself replay the current Capsule, ceremony
input sidecars, custody request/approvals, complete epoch chain, or separately
published plan/acceptance files. Put every public artifact under one dedicated public
evidence directory and create a canonical `pilot-index.json`. Every path is relative
to the index directory; absolute paths, `..` escape, and symlinks resolving outside
that directory are rejected:

```json
{"capsule":"current-capsule.json","ceremonies":[{"bundle":"provider/ceremony-bundle.json","issuer_response":"provider/issuer-response.json","request":"provider/admission-request.json","subject_identity":"provider/subject-identity.json","subject_response":"provider/subject-response.json","trust_root":"provider/trust-root.json"},{"bundle":"observer-a/ceremony-bundle.json","issuer_response":"observer-a/issuer-response.json","request":"observer-a/admission-request.json","subject_identity":"observer-a/observer-identity.json","subject_response":"observer-a/subject-response.json","trust_root":"observer-a/trust-root.json"},{"bundle":"observer-b/ceremony-bundle.json","issuer_response":"observer-b/issuer-response.json","request":"observer-b/admission-request.json","subject_identity":"observer-b/observer-identity.json","subject_response":"observer-b/subject-response.json","trust_root":"observer-b/trust-root.json"}],"deployment":{"acceptances":["observer-a/plan-acceptance.json","observer-b/plan-acceptance.json"],"activation":"plan-activation.json","attestations":["observer-a/deployment-attestation.json","observer-b/deployment-attestation.json"],"membership":"deployment-plan-membership.json","plan":"deployment-plan.json","primary_ceremony_bundle":"provider/ceremony-bundle.json","view":"attestation-view.json"},"epochs":[{"approvals":["custodian-a/membership-approval.json","custodian-b/membership-approval.json"],"ceremony_bundles":["provider/ceremony-bundle.json","observer-a/ceremony-bundle.json","observer-b/ceremony-bundle.json"],"epoch":"epoch-1.json","request":"membership-request-1.json"}],"format":"mortalos-placement-admission-pilot-evidence-index/1","source_commit":"<40-lowercase-hex>"}
```

Add one chronological `epochs` entry for every successor, including that request's
complete approval and ceremony-bundle set. First create the compact, no-replace public
chain receipt:

```powershell
node scripts/create-placement-admission-pilot-evidence.mjs `
  --expected-source-commit <exact-40-lowercase-hex> `
  --index <public-evidence-dir>/pilot-index.json `
  --output <public-evidence-dir>/pilot-evidence.json
```

A second verifier checkout/process must rerun every public sidecar, not merely restore
the receipt:

```powershell
node scripts/verify-placement-admission-pilot-evidence.mjs `
  --evidence <public-evidence-dir>/pilot-evidence.json `
  --expected-source-commit <exact-40-lowercase-hex> `
  --index <public-evidence-dir>/pilot-index.json
```

This rechecks exact request/trust-root/subject-identity bytes, restores both public role
responses, and re-finalizes every ceremony to require exact bundle-byte equality;
rederives every epoch request from its recorded bundles; replays each current-
custodian approval and finalized predecessor chain; recreates plan activation from the
separate plan/acceptance files; verifies current-Capsule membership convergence; and
recreates every attestation plus the compact view. Input permutations inside unordered
sets reproduce identical receipt bytes. A self-rehashed receipt restores only as
`public_chain_verified:false`; only the full sidecar replay reports
`public_chain_verified:true`.

The receipt deliberately records `source_commit_execution_binding:"recorded-only"`.
Matching `--expected-source-commit` prevents index/receipt disagreement but does not
prove that the processes executed a clean checkout of those bytes; exact-SHA CI,
immutable review, and each operator's clean-checkout evidence remain separate gates.
It also fixes topology and both independence verdicts to `unproven`.

Each role administrator must now make its clean-checkout statement attributable to the
same public key that signed its protocol artifact. Keep the public artifact and receipt
output outside the Git checkout. From that role's own checkout and authority custody,
run this once for every signed artifact it publishes:

```powershell
node scripts/attest-placement-admission-role-execution.mjs `
  --authority <role-local-authority.json> `
  --artifact <public-artifact.json> `
  --artifact-id <authenticated-sha256-id-reported-by-the-artifact-cli> `
  --artifact-kind <artifact-kind> `
  --role <role> `
  --source-commit <exact-40-lowercase-hex> `
  --repo-root <role-local-clean-checkout> `
  --output <public-evidence-dir>/<role>-<artifact>-source-receipt.json
```

Use only these fixed mappings:

| Public signed artifact | `--artifact-kind` | `--role` |
| --- | --- | --- |
| issuer ceremony role response | `ceremony-role-response` | `issuer` |
| subject ceremony role response | `ceremony-role-response` | `subject` |
| membership epoch approval | `membership-epoch-approval` | `custodian` |
| deployment plan acceptance | `deployment-plan-acceptance` | `observer` |
| deployment observation attestation | `deployment-observation-attestation` | `observer` |

The CLI resolves the exact repository root, requires its `HEAD` to equal the requested
commit, and rejects any tracked, untracked, or submodule status before private-key use.
It then signs a digest of the exact artifact bytes under the existing durable sign-once
authority and publishes the canonical receipt no-replace. An exact retry is byte-
identical. The durable tuple is fixed by artifact kind and authenticated artifact ID,
so a different source claim or byte digest for that same artifact identity halts as
equivocation rather than creating a second receipt.

After the original public-chain verifier passes, the coordinator collects every role
receipt and creates the aggregate. Repeat `--execution-receipt` once for every issuer
and subject response, every custody approval in every epoch, every plan acceptance,
and every deployment attestation:

```powershell
node scripts/create-placement-admission-pilot-source-attestation.mjs `
  --index <public-evidence-dir>/pilot-index.json `
  --pilot-evidence <public-evidence-dir>/pilot-evidence.json `
  --expected-source-commit <exact-40-lowercase-hex> `
  --execution-receipt <public-evidence-dir>/<receipt-1>.json `
  --execution-receipt <public-evidence-dir>/<receipt-2>.json `
  --output <public-evidence-dir>/pilot-source-attestation.json
```

A fresh verifier must receive the same complete receipt set and exact public sidecars:

```powershell
node scripts/verify-placement-admission-pilot-source-attestation.mjs `
  --attestation <public-evidence-dir>/pilot-source-attestation.json `
  --index <public-evidence-dir>/pilot-index.json `
  --pilot-evidence <public-evidence-dir>/pilot-evidence.json `
  --expected-source-commit <exact-40-lowercase-hex> `
  --execution-receipt <public-evidence-dir>/<receipt-1>.json `
  --execution-receipt <public-evidence-dir>/<receipt-2>.json
```

Pass requires `receipts_verified:true`,
`source_commit_execution_binding:"role-key-attested-artifacts"`, the exact expected
artifact count, and `unsigned_coordinator_execution_binding:"unproven"`. Receipt order
does not matter. Missing, duplicate, modified, wrong-key, wrong-artifact, wrong-role,
or wrong-source receipts fail before aggregate output.

This result is role-key-attributed operator testimony under the conforming CLI. A
dishonest operator can invoke lower-level signing code or falsely describe how an
artifact was produced, and unsigned coordinator artifacts remain unattested. It is
therefore stronger than `recorded-only` index agreement but is not exact-SHA CI,
immutable review, administrator separation, or physical topology proof.

The coordinator does not receive a new authority key. Instead, create the final source
verdict from the same complete public sidecars and role receipt set:

```powershell
node scripts/create-placement-admission-pilot-source-verdict.mjs `
  --index <public-evidence-dir>/pilot-index.json `
  --pilot-evidence <public-evidence-dir>/pilot-evidence.json `
  --pilot-source-attestation <public-evidence-dir>/pilot-source-attestation.json `
  --expected-source-commit <exact-40-lowercase-hex> `
  --execution-receipt <public-evidence-dir>/<receipt-1>.json `
  --execution-receipt <public-evidence-dir>/<receipt-2>.json `
  --output <public-evidence-dir>/pilot-source-verdict.json
```

The read-only verifier uses the same arguments plus
`--verdict <public-evidence-dir>/pilot-source-verdict.json`. Pass requires
`participant_receipts_verified:true`, `public_chain_verified:true`,
`unsigned_protocol_artifacts_verified:true`, and
`coordinator_protocol_authority:"not-required-for-verification"`. The verifier
classifies every unsigned protocol artifact as either participant-endorsed or
deterministically replayed. `coordinator_execution_binding`, topology, and both
independence fields remain `unproven`.

After every participant independently inspects the final source verdict, each unique
role authority ratifies it once for the exact deployment plan:

```powershell
node scripts/ratify-placement-admission-pilot-source-verdict.mjs `
  --authority <role-local-authority.json> `
  --deployment-plan <public-evidence-dir>/deployment-plan.json `
  --source-verdict <public-evidence-dir>/pilot-source-verdict.json `
  --output <public-evidence-dir>/<role-key>-inventory-ratification.json
```

The authority's durable tuple is keyed by deployment-plan ID. An exact retry is byte-
identical; another verdict for the same plan must halt. Once every unique role key has
published one ratification, create the closure with the same public index, evidence,
source attestation, source verdict, execution receipts, and repeated `--ratification`
arguments:

```powershell
node scripts/create-placement-admission-pilot-inventory-closure.mjs `
  --index <public-evidence-dir>/pilot-index.json `
  --pilot-evidence <public-evidence-dir>/pilot-evidence.json `
  --pilot-source-attestation <public-evidence-dir>/pilot-source-attestation.json `
  --pilot-source-verdict <public-evidence-dir>/pilot-source-verdict.json `
  --expected-source-commit <exact-40-lowercase-hex> `
  --execution-receipt <public-evidence-dir>/<receipt-1>.json `
  --ratification <public-evidence-dir>/<role-key-1>-inventory-ratification.json `
  --output <public-evidence-dir>/pilot-inventory-closure.json
```

The read-only closure verifier adds
`--closure <public-evidence-dir>/pilot-inventory-closure.json` to the same complete
input set. Pass requires `inventory_closure:"all-role-keys-ratified"`, the exact unique
role-key count, `ratifications_verified:true`, and `source_verdict_verified:true`.
A missing, duplicate, outsider, wrong-plan, wrong-verdict, or wrong-source
ratification fails. This is plan-scoped participant inventory finality; artifacts
unknown to every honest participant remain unknowable.

## Induced-failure matrix

Run fresh evidence epochs for each trial. Never overwrite or backfill a failed epoch.

1. Stop one signer before ceremony completion: no ceremony output.
2. Serve a wrong role/key at one signed origin, substitute one public role response
   before offline finalization, present an untrusted certificate, or mismatch the local
   certificate/private-key pair: reject before output or new signing-authority creation.
3. Ask a non-custodian to approve, provide fewer approvals than the current custody
   threshold, or mix approvals from different requests: no membership epoch output.
4. Cut one observer's network before observation: no partial compact view.
5. Substitute one membership epoch or omit the latest candidate: binding or attestation
   rejects before endpoint access.
6. Give one observer a different plan for the same ceremony: durable acceptance halt.
7. Give one observer a different view/instant under one accepted plan: durable
   attestation halt; the original exact retry remains byte-identical.
8. Rotate membership: an old request cannot authorize a changed epoch; create the
   successor with its exact predecessor and repeat the full lifecycle.
9. Repeat the successful trial from a second independent verifier process and compare
   exact manifest bytes and IDs.

## Promotion criteria

The pilot is evidence-ready only when:

- all operators report one exact source commit and input digest set;
- no private authority, TLS private key, bearer token, or browser profile crosses role
  custody; each signer administrator publishes only its token-free role response and
  the coordinator finalizes without network or secrets;
- issuer, subject, and both observers have documented distinct administrators,
  credentials, hosts, and intended failure domains;
- the complete member-ceremony/request/custody-approval/epoch/plan/acceptance/
  activation/membership/attestation/view chain verifies from public bytes through the
  pilot-evidence verifier in a fresh process, with
  `public_chain_verified:true`, `source_commit_execution_binding:"recorded-only"`,
  and the exact expected source commit;
- every role-signed artifact in that reverified chain has one matching role execution
  receipt and a fresh verifier recreates the exact aggregate with
  `receipts_verified:true`,
  `source_commit_execution_binding:"role-key-attested-artifacts"`, and
  `unsigned_coordinator_execution_binding:"unproven"`;
- the final source verdict recreates the exact public chain and receipt aggregate,
  classifies every unsigned protocol artifact without a coordinator authority, and
  reports all three live verification flags true while retaining
  `coordinator_execution_binding:"unproven"`;
- every unique role key publishes one plan-bound inventory ratification and a fresh
  verifier recreates the complete closure with `all-role-keys-ratified`; a competing
  verdict under the same plan must fail the durable sign-once policy;
- every induced-failure case fails before forbidden output/effect and leaves immutable
  failed-epoch evidence untouched;
- exact-SHA CI and immutable review pass for the source used by all operators.

Even then, the compact view proves signatures and protocol consistency under configured
trust roots. Physical independence, host ownership, network diversity, clock honesty,
and Sybil resistance require separately sourced operational evidence and must remain
explicitly qualified rather than inferred from the protocol artifacts.
