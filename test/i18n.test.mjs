import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { messages as enMessages } from "../lab/i18n/en.mjs";
import { messages as koMessages, staticReplacements } from "../lab/i18n/ko.mjs";
import { createTranslator } from "../lab/i18n/index.mjs";
import { renderKoreanHtml } from "../scripts/build-lab.mjs";

function placeholders(message) {
  return [...message.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/g)].map((match) => match[1]).sort();
}

test("English and Korean runtime catalogs have exact keys and placeholder parity", () => {
  assert.deepEqual(Object.keys(koMessages).sort(), Object.keys(enMessages).sort());
  for (const key of Object.keys(enMessages)) {
    assert.equal(typeof enMessages[key], "string", key);
    assert.equal(typeof koMessages[key], "string", key);
    assert.deepEqual(placeholders(koMessages[key]), placeholders(enMessages[key]), key);
  }
  assert.equal(createTranslator("en")("gptFallback", { message: "offline" }).includes("offline"), true);
  assert.equal(createTranslator("ko")("gptFallback", { message: "offline" }).includes("offline"), true);
  assert.match(enMessages.continuityProposalObserved, /verify locally before accepting/i);
  assert.doesNotMatch(enMessages.continuityProposalObserved, /\bverified\b/i);
  assert.match(koMessages.continuityProposalObserved, /로컬 검증 예정/);
  assert.doesNotMatch(koMessages.continuityProposalObserved, /검증 완료/);
  assert.throws(() => createTranslator("ko")("missing"), /missing i18n message/);
});

test("build-time Korean first paint has exact locale, canonical, alternates, and language switch", async () => {
  const english = await readFile(new URL("../lab/index.html", import.meta.url), "utf8");
  const korean = renderKoreanHtml(english);
  assert.match(english, /<html lang="en">/);
  assert.match(english, /<link rel="canonical" href="https:\/\/mortal-os\.com\/">/);
  assert.match(english, /href="\/ko\/" lang="ko" hreflang="ko">한국어<\/a>/);
  assert.match(korean, /<html lang="ko">/);
  assert.match(korean, /<link rel="canonical" href="https:\/\/mortal-os\.com\/ko\/">/);
  assert.match(korean, /href="\/" lang="en" hreflang="en">English<\/a>/);
  for (const html of [english, korean]) {
    assert.match(html, /hreflang="en" href="https:\/\/mortal-os\.com\/"/);
    assert.match(html, /hreflang="ko" href="https:\/\/mortal-os\.com\/ko\/"/);
    assert.match(html, /hreflang="x-default" href="https:\/\/mortal-os\.com\/"/);
    assert.doesNotMatch(html, /\{[a-z][a-zA-Z0-9]*\}/);
    for (const invariant of ["GPT‑5.6", "mortalos/1", "canonical R1 result bytes"] ) {
      assert.match(html, new RegExp(invariant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
  assert.equal(Object.keys(staticReplacements).length >= 100, true);
});
