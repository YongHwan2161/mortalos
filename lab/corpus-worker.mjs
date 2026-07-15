import fork from "../test/vectors/fork.json";
import lifecycle from "../test/vectors/lifecycle.json";
import expected from "../test/vectors/portable-expected.json";
import rfc8032 from "../test/vectors/rfc8032-ed25519.json";
import singleton from "../test/vectors/singleton.json";
import { runPortableCorpus } from "../test/portable-corpus.mjs";
import { summarizePortableCorpus } from "./corpus-summary.mjs";

globalThis.onmessage = ({ data }) => {
  if (!data || data.type !== "run" || typeof data.id !== "string") return;
  try {
    const result = runPortableCorpus({ fork, lifecycle, rfc8032, singleton });
    const summary = summarizePortableCorpus(result, expected);
    globalThis.postMessage({
      id: data.id,
      type: "result",
      shared_memory_available: typeof SharedArrayBuffer === "function",
      ...summary
    });
  } catch (error) {
    globalThis.postMessage({
      id: data.id,
      type: "error",
      message: error instanceof Error ? error.message : "corpus failed"
    });
  }
};
