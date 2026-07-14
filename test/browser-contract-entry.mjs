import fork from "./vectors/fork.json";
import lifecycle from "./vectors/lifecycle.json";
import rfc8032 from "./vectors/rfc8032-ed25519.json";
import singleton from "./vectors/singleton.json";
import { runPortableCorpus } from "./portable-corpus.mjs";

globalThis.__MORTALOS_BROWSER_CONTRACT__ = runPortableCorpus({
  fork,
  lifecycle,
  rfc8032,
  singleton
});
