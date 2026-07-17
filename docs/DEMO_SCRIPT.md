# MortalOS 2:50 Demo Script

Target duration: **2 minutes 50 seconds**

Target audience: Build Week judges evaluating technological implementation, design,
potential impact, and quality of idea.

Recording rule: record only the final logged-out public Pages URL and the reviewed
repository. Hide browser chrome where practical. Do not show terminals containing
environment variables, account pages, notifications, tokens, or private material.

## Shot and narration plan

### 0:00–0:12 — The problem

On screen: hero, title, and `Run the 90-second proof`.

Narration:

> A process can restart. A server can disappear. But when is a network-native entity
> still the same entity—and when is it actually dead? MortalOS turns that question
> into signed, deterministic evidence.

### 0:12–0:31 — Honest boundary

On screen: `What this build proves`, then the persistent one-failure-domain warning.

Narration:

> This is a portable lifecycle protocol and falsification Lab, not a finished
> distributed operating system. Three browser Workers hold three non-extractable
> keys, but one browser is still one physical failure domain. The UI never gets to
> decide identity, succession, forks, or death.

### 0:31–0:50 — Deterministic baseline

Action: click `Run deterministic baseline`.

On screen: three accepted lifecycle steps, replay rejection, and fork result.

Narration:

> First, committed public evidence establishes the baseline. Custody turns over from
> A, B, C to D, E, F without changing identity. Exact replay is rejected, signed
> siblings create a fork, and death requires both irreversible authority loss and an
> explicitly complete evidence inventory.

### 0:50–1:17 — GPT-5.6 proposes an attack

Action: select `Fork and equivocation`, retain the displayed hypothesis, and click
`Ask GPT, compile, and run kernel`.

On screen: model name, selected mutation, model prediction, kernel actual, digest.

Narration:

> Now GPT-5.6 acts as an untrusted red-team witness. It can choose only one of ten
> schema-bound mutations. Its free-form explanation is display-only. MortalOS
> compiles the enum into canonical bytes and sends fresh committed evidence to the
> existing kernel. The secret stays server-side, requests are bounded and rate
> limited, and Responses API storage is disabled.

### 1:17–1:39 — The useful disagreement

On screen: keep model prediction and kernel actual visible. Highlight their
difference if present.

Narration:

> The disagreement is intentional evidence, not a demo failure. In our fixed
> twenty-five-case evaluation, GPT chose the intended attack twenty-five times and
> covered all ten mutations—but its exact status and rejection-code prediction was
> wrong twenty-five times. GPT is excellent at proposing what to test. It is not the
> judge.

### 1:39–1:58 — Turn GPT off

Action: click `Replay without GPT`.

On screen: `PASS`, unchanged digest, unchanged kernel result.

Narration:

> We now turn GPT completely off. No second API call occurs. The same canonical
> digest is evaluated again and produces the same kernel result. Model availability,
> wording, or opinion cannot change protocol truth.

### 1:58–2:20 — Deeper technical proof

On screen: scroll through live incubator, fixed public reference, and complete corpus.
Use a pre-recorded successful state; remove loading time.

Narration:

> The advanced Lab exposes the deeper proof: real non-extractable Worker keys, a
> logical two-of-three heartbeat, one-key rejection, replay and resurrection
> rejection, complete original-custodian turnover, canonical evidence export, and a
> byte-identical JavaScript and Python R1 evidence profile. Chromium also runs fifteen
> named, thirteen boundary, and ten thousand seeded adversarial cases.

### 2:20–2:39 — Codex and human roles

On screen: repository README, Build Week evidence document, and green checks.

Narration:

> Codex with GPT-5.6 helped turn the original idea into falsifiable definitions,
> red-team mortality completeness, implement cross-runtime and browser tests, and
> build the exact-SHA deployment verifier. The human retained the North Star, threat
> assumptions, claim limits, license, category, and final submission decisions.

### 2:39–2:50 — Close

On screen: return to hero and public URL.

Narration:

> MortalOS is a small, honest kernel for a large question: can digital life preserve
> identity across hosts—and stop only when the evidence really says it must?

## Edit gate

- final duration is `00:02:50` or shorter;
- voice is audible throughout and captions match the narration;
- no loading pause exceeds one second;
- the public URL works logged out;
- model prediction and kernel actual remain legible at 1080p;
- the exact deployed source SHA appears once in the repository or manifest shot;
- no credential, account detail, private key, notification, or unrelated tab appears;
- final video, repository, Devpost story, and deployment use the same reviewed head;
  and
- YouTube visibility is Public, not Unlisted or Private, if the rules require Public.
