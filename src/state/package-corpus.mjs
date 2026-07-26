import { encodeBase64Url } from "../bytes.mjs";
import {
  createStatePackageInput,
  createStatePackageTransitionPayload,
  deterministicReferenceResource
} from "./package.mjs";

export const STATE_PACKAGE_CORPUS_GENOME_HASH =
  "sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
export const STATE_PACKAGE_CORPUS_PRIOR_ROOT =
  "sha256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBQ";

export function buildStatePackageCorpus() {
  const inputBytes = createStatePackageInput();
  const statePackage = createStatePackageTransitionPayload({
    genomeHash: STATE_PACKAGE_CORPUS_GENOME_HASH,
    inputBytes,
    priorStateRoot: STATE_PACKAGE_CORPUS_PRIOR_ROOT,
    resourceBytes: deterministicReferenceResource()
  });
  return {
    entries: [{
      chunk_digests: statePackage.manifest.chunks.map(({ digest }) => digest),
      id: "reference-1mib",
      input_base64url: encodeBase64Url(statePackage.inputBytes),
      manifest_base64url: encodeBase64Url(statePackage.manifestBytes),
      next_state_root: statePackage.nextStateRoot,
      receipt_base64url: encodeBase64Url(statePackage.receiptBytes),
      resource_root: statePackage.manifest.resource_root,
      resource_size: statePackage.resourceBytes.byteLength
    }],
    format: "mortalos-state-package-corpus/1",
    genome_hash: STATE_PACKAGE_CORPUS_GENOME_HASH,
    prior_state_root: STATE_PACKAGE_CORPUS_PRIOR_ROOT
  };
}
