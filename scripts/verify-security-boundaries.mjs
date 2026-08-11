import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { full } from "acorn-walk";
import {
  analyzeFunctionOwnership,
  analyzePostAwaitBorrowedIdentifiers,
  discoverExportedAsyncSecurityEntrypoints,
  findFirstSuspension,
  findSecurityEntrypoint,
  parseSecurityModule
} from "./security-boundary-ast.mjs";

const root = new URL("../", import.meta.url);
const registry = JSON.parse(await readFile(new URL("security/async-entrypoints.json", root), "utf8"));
assert.equal(registry.format, "mortalos-async-security-entrypoints/2");
assert.ok(Array.isArray(registry.entries) && registry.entries.length >= 7);
assert.ok(Array.isArray(registry.export_scopes) && registry.export_scopes.length >= 9);
assert.ok(Array.isArray(registry.classifications));

const SECURITY_EXPORT_SCOPES = Object.freeze([
  "cli/node-authority.mjs",
  "lab/distributed/http-counter-replica.mjs",
  "lab/live-incubator.mjs",
  "lab/participant/durable-participant.mjs",
  "lab/participant/live-endpoint.mjs",
  "lab/participant/quorum-endpoint.mjs",
  "lab/participant/webcrypto-key-store.mjs",
  "lab/product-continuity.mjs",
  "lab/storage/confidential-counter-authority-store.mjs",
  "lab/storage/durable-document.mjs",
  "lab/storage/durable-store.mjs",
  "lab/scenario-compiler.mjs",
  "lab/transport/http-relay.mjs",
  "lab/transport/virtual-transport.mjs",
  "src/confidential/counter.mjs",
  "src/confidential/keys.mjs",
  "src/confidential/package.mjs",
  "src/confidential/recovery.mjs",
  "src/continuity.mjs",
  "src/distributed/quorum-counter-store.mjs",
  "src/placement/lineage-controller.mjs",
  "src/state/recovery.mjs",
  "src/transport/corpus.mjs",
  "src/transport/chunk-data-plane.mjs",
  "lab/transport/webrtc-peer.mjs"
]);
const REQUIRED_ENTRYPOINTS = Object.freeze([
  "cli/node-authority.mjs:export async function signNodeAuthority",
  "lab/participant/live-endpoint.mjs:LiveEndpointParticipant.async acceptHandoff",
  "lab/participant/webcrypto-key-store.mjs:async function signBytes",
  "lab/storage/durable-document.mjs:export async function replayDurableDocument",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async #signDurably",
  "lab/transport/http-relay.mjs:HttpRelayTransport.async publish",
  "src/confidential/keys.mjs:export async function importCustodianPublicKey",
  "src/confidential/keys.mjs:export async function unwrapEpochKey",
  "src/confidential/keys.mjs:export async function wrapEpochKey",
  "src/confidential/package.mjs:async function decryptConfidentialPackageWithEpochKey",
  "src/confidential/package.mjs:export async function aesGcmKnownAnswer",
  "src/confidential/package.mjs:export async function createConfidentialPackage",
  "src/confidential/package.mjs:export async function decryptConfidentialPackage",
  "src/confidential/recovery.mjs:export async function createConfidentialStatePackage",
  "src/confidential/recovery.mjs:export async function recoverAndDecryptConfidentialState",
  "src/confidential/recovery.mjs:export async function rotateConfidentialState",
  "src/continuity.mjs:export async function continueContinuity",
  "src/continuity.mjs:export async function createContinuity",
  "src/placement/lineage-controller.mjs:export async function commitLineagePlacementGeneration",
  "src/state/recovery.mjs:export async function recoverStatePackage",
  "src/transport/chunk-data-plane.mjs:export async function publishStateChunk",
  "src/transport/chunk-data-plane.mjs:export async function publishStatePackageChunks"
]);
assert.deepEqual(
  registry.entries.map(({ file, entrypoint }) => `${file}:${entrypoint}`).sort(),
  [...REQUIRED_ENTRYPOINTS].sort(),
  "the verifier-owned direct-audit set cannot be downgraded by editing the registry"
);
assert.deepEqual(
  [...registry.export_scopes].sort(),
  [...SECURITY_EXPORT_SCOPES].sort(),
  "the registry cannot narrow the verifier-owned security export scope"
);
const DEEP_OWNERSHIP_PRIMITIVES = new Set([
  "clone",
  "confidentialEpochStoreCapability",
  "copyBoundedOwnDataArray",
  "createUint8Array",
  "createWrapLabel",
  "decodeBase64Url",
  "decryptConfidentialPackageWithEpochKey",
  "ownChunkBytes",
  "ownConfidentialBytes",
  "ownDataArrayLength",
  "ownRelayBytes",
  "ownCryptoInputBytes",
  "ownOptionalCryptoInputBytes",
  "ownSigningRequest",
  "ownBytes",
  "ownSigningBytes",
  "recoverStatePackage",
  "reserveCounterAuthority",
  "resourcePlaintextParts",
  "snapshotConfidentialCustodians",
  "snapshotAuthority",
  "snapshotContinuityContinueInvocation",
  "snapshotContinuityCreateInvocation",
  "snapshotLineagePlacementCommitInvocation",
  "snapshotDataMethod",
  "snapshotNamedOwnDataValues",
  "snapshotObservedCounterAuthorityEquivocation",
  "snapshotRecoveryInvocation",
  "taggedBytes",
  "typedArraySet",
  "unwrapEpochKey",
  "verifyConfidentialPackage",
  "verifyConfidentialRotationAuthorization",
  "verifyStatePackage"
]);

// This table is verifier-owned. A registry entry may select only an exact binding whose
// implementation digest is pinned here; a same-named local function is never sufficient.
const OWNERSHIP_PROVENANCE = Object.freeze({
  "cli/node-authority.mjs": {
    ownSigningRequest: ["local", null, null, "52744fd986a85ad456efa128950a1378e70872bd36c3a9aca484af52ecd1800f"]
  },
  "lab/participant/live-endpoint.mjs": {
    clone: ["local", null, null, "ad23ae7000029bb45a994f26519180b268e8aa8a309674fd59b939f63f27c67a"]
  },
  "lab/participant/webcrypto-key-store.mjs": {
    ownSigningBytes: ["local", null, null, "b7cc87a511d933825955b7c73f803a7a520f1aa735354137ba89eb0f056ec234"]
  },
  "lab/storage/durable-document.mjs": {
    clone: ["local", null, null, "1bc49fcf41c0de23a56b366455a1851e81c1d079a090ac0351cccb1d580dea1c"]
  },
  "lab/storage/durable-store.mjs": {
    clone: ["local", null, null, "1bc49fcf41c0de23a56b366455a1851e81c1d079a090ac0351cccb1d580dea1c"],
    snapshotNamedOwnDataValues: ["import", "../../src/primordials.mjs", "snapshotNamedOwnDataValues", "aab42c8f9795139df8c6073da9fd33656fb5858fc7e18fe466bc416b64c9f74d"]
  },
  "lab/transport/http-relay.mjs": {
    ownRelayBytes: ["local", null, null, "b07f4ad8f5d37801cac227c96c83dbcc3730a036c5fa40634467b28fca6ebbd8"]
  },
  "lab/transport/webrtc-peer.mjs": {
    decodeRelayMessageBytes: ["import", "../../src/transport/protocol.mjs", "decodeRelayMessageBytes", "18513ca4248da3da9959e97dfe99e9759c6b51703cade672c2c838199aa5972b"]
  },
  "src/confidential/keys.mjs": {
    assertCustodianId: ["import", "./format.mjs", "assertCustodianId", "5c7bebc0710396477d78548ba540c03f7daaf8d7e3fb5c1246a9e7dee4e1bb13"],
    assertDigest: ["import", "./format.mjs", "assertDigest", "522ba6388e000fceb91e1603aaa482279afab3456fee0241792b0863fb13e30b"],
    createWrapLabel: ["local", null, null, "5e85c89b82b6f7df4452fb64d20d23f6d82e7383c8c0967546233483301d6040"],
    decodeBase64Url: ["import", "../bytes.mjs", "decodeBase64Url", "ce5662daa959237f5103765d5ddc8eb7c17109903813faab83be7ff2f55d438d"],
    exactObjectKeys: ["import", "./format.mjs", "exactObjectKeys", "159d79090c69aab0a57cdd2fcdf98040ac12aab06e53d5a9fee777af314291cb"],
    snapshotNamedOwnDataValues: ["import", "../primordials.mjs", "snapshotNamedOwnDataValues", "aab42c8f9795139df8c6073da9fd33656fb5858fc7e18fe466bc416b64c9f74d"],
    taggedBytes: ["import", "./format.mjs", "taggedBytes", "5c2ad48cc1fd16fe4fbcf70227c7f387bf54c5eedc1c7490238b25640103e28f"]
  },
  "src/confidential/package.mjs": {
    decryptConfidentialPackageWithEpochKey: ["local", null, null, "4f392d2819df49623629f3e46ec746b131911e3ac63cbb63846a02b88d46481d"],
    ownCryptoInputBytes: ["local", null, null, "a60d92ee317cd96d8535ad1ce1d9d44286fc2d766492a10bdae88fe85c855fd0"],
    ownOptionalCryptoInputBytes: ["local", null, null, "9f72c7e820b52b0e9eae19c4cfffbf122ce25724dc4b1e89ffecb700266a9ab9"],
    reserveCounterAuthority: ["import", "./counter.mjs", "reserveCounterAuthority", "b1ab2b17d8537024fe3be5e2208e8801d866231eaa04d64b96a336e3c6891b26"],
    resourcePlaintextParts: ["local", null, null, "333facc6ebdbedb2471e1c6bbdf480885274e2c0e1494df1de8fd53181910633"],
    snapshotConfidentialCustodians: ["local", null, null, "c6bdf20a91e4a127ca23ec48c9a778c081d540d9424982e1c7310ad093287e72"],
    unwrapEpochKey: ["import", "./keys.mjs", "unwrapEpochKey", "73aad90cfc371048f1cfa3cef6680d475ef2ec6177731607dafa2253f6bcb0b1"],
    verifyConfidentialPackage: ["local", null, null, "04ba7573256f59b66b1a39e071663466a632f741fdad1071b12603464c423055"]
  },
  "src/confidential/recovery.mjs": {
    asBytes: ["import", "../bytes.mjs", "asBytes", "b4aa456500c216feae0fa78bd05bc68e83c1b8d27beeef9b6e3a58196a4fcaf3"],
    byteLengthOfBytes: ["import", "../bytes.mjs", "byteLengthOfBytes", "022b846ebc79de80693e31fe79ae04f0925e65d31ea8ff8c7cdcf638c1fa715f"],
    confidentialEpochStoreCapability: ["local", null, null, "5855d541941d5c027f95dadcde3d894a4b7e8fef13bc865354aa2a04d9ba5da1"],
    ownConfidentialBytes: ["local", null, null, "07f205c0678883b6c30812a71db53636e8601b42b87f8dffe7eeed0b44822125"],
    createUint8Array: ["import", "../primordials.mjs", "createUint8Array", "6d5cd3a9fbb76a1608e481ff3a08543f0ec829f5782304fdbacc9c87571114fc"],
    recoverStatePackage: ["import", "../state/recovery.mjs", "recoverStatePackage", "730ca266922bd233781e051f335965d332a1ca782748b6ef9ea2aabb6547db1f"],
    snapshotConfidentialCustodians: ["import", "./package.mjs", "snapshotConfidentialCustodians", "c6bdf20a91e4a127ca23ec48c9a778c081d540d9424982e1c7310ad093287e72"],
    snapshotNamedOwnDataValues: ["import", "../primordials.mjs", "snapshotNamedOwnDataValues", "aab42c8f9795139df8c6073da9fd33656fb5858fc7e18fe466bc416b64c9f74d"],
    snapshotObservedCounterAuthorityEquivocation: ["local", null, null, "5f92530853310f0d6e9cf37137e4aebbaa2224097f0519d1372f8ede3382fefe"],
    typedArraySet: ["import", "../primordials.mjs", "typedArraySet", "d6ce72e8529bc196e44993fa8b0fafacfdd896389e394ebffd7dddce47cbc433"],
    verifyConfidentialRotationAuthorization: ["local", null, null, "de4b18f2828ea56f3f424b2448a1b4d069c1663effd541f0c304f2f3adc4f611"]
  },
  "src/continuity.mjs": {
    ownBytes: ["local", null, null, "aed824d812b7c9116a8dec952fd972bce5fae552eb838593da1ecabdb5108645"],
    snapshotAuthority: ["local", null, null, "4da0c43baa145830a6776e92790263112e5b97be969c35ad2e8615e3165904cf"],
    snapshotContinuityContinueInvocation: ["local", null, null, "0aa1431f952a7579c1dbce981b3b4627ebdf46d5a1598bbe27e5a0ca2d71ed16"],
    snapshotContinuityCreateInvocation: ["local", null, null, "4d63780c80c014e7815db639b1b4e13f14d0aefe9917a50f6395673358927f7c"],
    snapshotNamedOwnDataValues: ["import", "./primordials.mjs", "snapshotNamedOwnDataValues", "aab42c8f9795139df8c6073da9fd33656fb5858fc7e18fe466bc416b64c9f74d"]
  },
  "src/placement/lineage-controller.mjs": {
    snapshotLineagePlacementCommitInvocation: ["local", null, null, "57122aceff4cf285b7d5cc0f2e9f3e9b7b6e1573281d3a4317cfa26e41add2af"]
  },
  "src/state/recovery.mjs": {
    snapshotRecoveryInvocation: ["local", null, null, "f2bcec674dea7d59d65de8fafc0eea7de0bb0b57b8d2383afde0551bed427bfe"],
    verifyStatePackage: ["import", "./package.mjs", "verifyStatePackage", "0afe9e042d0173a57791681e879dc73b9f3341fffb834019df8656980ab36b10"]
  },
  "src/transport/chunk-data-plane.mjs": {
    copyBoundedOwnDataArray: ["import", "../primordials.mjs", "copyBoundedOwnDataArray", "0c06de8630e4d635608978ab9fa85f383ac93e82b53093b12181ba09184a397f"],
    ownChunkBytes: ["local", null, null, "080ab7e94b99ca8c55e9155924622d9f978a059ccdce010a038677fe5918f1c3"],
    ownDataArrayLength: ["import", "../primordials.mjs", "ownDataArrayLength", "4ebd5a72f6ce33596751b3785e360614dc2d40b4e1f134bab269f9a64da3af95"],
    snapshotDataMethod: ["import", "../primordials.mjs", "snapshotDataMethod", "787d3387bece99a20eaa4c7ef8aa75650daa91cbd6fe7d991853d6f76a57fae7"]
  }
});

const OWNERSHIP_MODULE_DIGESTS = Object.freeze({
  "cli/node-authority.mjs": "1382e82cf9cd5e7d129dee4f89a0e6e270c3dc326dc6d8ae82973a2a8896b0cd",
  "lab/distributed/http-counter-replica.mjs": "a2cdda85d3b77347f69237eab4f23a7de258573f50f2a30ae83cc7832d17a5ac",
  "lab/live-incubator.mjs": "c813cfe5a98f6415ab8310f18c36a7db7c5100b499f5dde037b8575c57db988c",
  "lab/participant/durable-participant.mjs": "d4cf3f3c2190f080a0310437bb438c4456a7a9feb1258aef25e4cb1075feecb0",
  "lab/participant/live-endpoint.mjs": "f6b124b56be9c8ab4e1bc6038b4c9d223aa49b8987398dac5940d3478afa198b",
  "lab/participant/quorum-endpoint.mjs": "c68507768d78b04d2807d7cbc597578c59cd23cc0441e00c887c8cfcd233c91a",
  "lab/participant/webcrypto-key-store.mjs": "4653689d16d49d4073145fa8fa1eab24dda80487183353706500ef7cd79c7cc3",
  "lab/storage/confidential-counter-authority-store.mjs": "48f6bb602af094aaca7a35a8b6c0ba542e1a65d7a4224f101363bd211b4fe244",
  "lab/storage/durable-document.mjs": "6a12494b34d7f94e84e9c85c33ac53292f54421d77b4af48e093db90b1e27a9f",
  "lab/storage/durable-store.mjs": "95356dae9aeb166f1a214a310deb61e22275466bcc7d47c084902c55162c4f39",
  "lab/scenario-compiler.mjs": "15409c8e709ddf3e11c15efc3dba4cd314b69c66da691efc4ce2ed51164c9999",
  "lab/transport/http-relay.mjs": "50bbeaa94e2c42d93b3dc34ed25f173b51e8248d2e45e7c1a48a330779df2090",
  "lab/transport/virtual-transport.mjs": "ccc57815ca0c46ef96222767b036dbecdb0f787bc8ed2cae9696f9a248fca828",
  "src/bytes.mjs": "b210b22775b4e279394be49f64e854d7c19c849d9bcc8cf3fad952e601cd0e57",
  "src/confidential/counter.mjs": "9871611eb4868ee913d4dc092f2407fd6e8b299571ae637c11682c3f87621376",
  "src/confidential/format.mjs": "d3c9b70d31e2dc3007c495dc404f0a71ef65ae8557a10c6200fc6efec54a61bc",
  "src/confidential/keys.mjs": "79f350b7704c3c9e6cc1d0f891364b0a9cc050f8cee249fd3cc445a5f2123285",
  "src/confidential/package.mjs": "2edf8c8fce50dc09ee33243affff99069c3c6a3efa74bdcf52327a3c60f7aab3",
  "src/confidential/recovery.mjs": "30d7453b1af1107c26d17f779600f6b8828d8d07759c2198f89f665f49c36feb",
  "src/continuity.mjs": "defc12d9cd7d6aec2ecb0e9ca875a99375703d94e9210ecb41bbbea435dd3f76",
  "src/distributed/quorum-counter-store.mjs": "5aa2d7c0257c6e4ba4ef5502dadbc485a8fd0e95ce56fc98da30a6ff84265869",
  "src/placement/lineage-controller.mjs": "55cd515797b6d5430c95e307cb66ca096b489ce937781a4325eb26460d7ba9fc",
  "src/primordials.mjs": "a7a8c85573463956197926749e0bd41622470e1e640d4f3928e954ebd1c01630",
  "src/state/package.mjs": "082828e7e0db08bb5ca496bc47d0a6a969a01bcf99633c57150aa8fd576cf098",
  "src/state/recovery.mjs": "eb60562e036990845963b762a33c9f83e32ac09af139ce0876dbc972a5a90715",
  "src/transport/corpus.mjs": "dcb55a72317ce04e5d3f31744475873663389290d97646f8ba1cc473a5a9e94c",
  "src/transport/chunk-data-plane.mjs": "b11cbaa072c517db55b6edb1c605b57b3dc41d2b6496e50b37363110e20ff704",
  "src/transport/protocol.mjs": "d9d2f925b5f2753a1e0e927b4a6ae3ee2a471d728a3710a9810a9ef51ef8ab0b",
  "lab/transport/webrtc-peer.mjs": "26321761c8c98d909ff79a80f2373662a075a18d5d07b595a0686795b4691292"
});

// These synchronous producer/commit boundaries mint or persist replay-policy
// evidence. Pin their complete reviewed implementations so a later edit cannot
// silently weaken the module-private evaluation brand, prior-head reproof context,
// cumulative receipt high-water, or no-replace durable successor boundary while the
// async-only inventory remains green.
const SYNC_TRUST_BOUNDARY_MODULE_DIGESTS = Object.freeze({
  "lab/placement/confidential-controller.mjs": "0ff04b683512f9d8493ef5c6dd5720a57df9c2e0abcda562a273fd31bc3710d5",
  "src/placement/confidential.mjs": "b1340f5c3c8bac048db734650df0f1ca7147593204fc67db56fcab3f6c0f5e04"
});

// A classification is a reviewed security decision, not a permanent textual
// exemption. Pin both its exact function and its complete module so any drift
// requires the reviewer to revisit the classification before CI can pass.
const CLASSIFICATION_DIGESTS = Object.freeze({
  "cli/node-authority.mjs:export async function loadNodeAuthority": "5b0dcbd55cf97aadd22be8cc54f793156514e34c4f8eeb7416bf54b725bc3d65",
  "lab/live-incubator.mjs:BrowserIncubator.async birth": "eb0852385f67cc7a5957c821ed3c7e137604f3765780781dfb966a190f7b2592",
  "lab/live-incubator.mjs:BrowserIncubator.async completeHeartbeat": "87588c407a0f9d9be0f414c44c3254b3573797eba23b870d4db97395dbb7052d",
  "lab/live-incubator.mjs:BrowserIncubator.async nurture": "06ffca93c66f38faa0d979e2af41c394d89ff8f14df3b42f6256fa40e3393089",
  "lab/live-incubator.mjs:BrowserIncubator.async retire": "69281930c24ff1ec4e52505dfaf2f431285ad2de23f81d3edc964ce8788c44b0",
  "lab/live-incubator.mjs:BrowserIncubator.async tryOneSigner": "b4266be963106e4f42f8c45035db9b5ccce3dc852f04dec2865eb71451537e25",
  "lab/scenario-compiler.mjs:export async function compileScenario": "e96d5859c575058b57ccd1a400097cb88eb96118acb40e8025924ba625b06d40",
  "lab/scenario-compiler.mjs:export async function runCompiledScenario": "03cab1808e47729c988b569b03fc674b28bfc114da53113c738b40bc0126ffe3",
  "lab/transport/virtual-transport.mjs:VirtualTransportNetwork.async flush": "5db220605d1c142b282307ca32ecb6ea5e3e4ad97ef3e19118389e2bf3e720be",
  "src/transport/corpus.mjs:export async function runTransportScheduleCorpus": "acc6056a63f3949df9f8720707d6787aa65abaeb6895eb83b4b23f28aa103d39",
  "lab/distributed/http-counter-replica.mjs:HttpCounterReplica.async snapshot": "a320613f51dfb1320a6031090ad3c7881595925f545d79ba127da9f4f08abf53",
  "lab/participant/durable-participant.mjs:DurableParticipant.async create": "97bd590cdf4e3067ccf53ae9643ea91c87c92f3f5188a751b524013c55bac234",
  "lab/participant/durable-participant.mjs:DurableParticipant.async nurture": "434a9a378329893d171392589c9247bf66437a616dccd38d449af8b7687cd8f4",
  "lab/participant/durable-participant.mjs:DurableParticipant.async removeAuthority": "2891a61db2539792fc579f60006093acef56cbf3b2700cd7ac6a982815e62634",
  "lab/participant/durable-participant.mjs:DurableParticipant.async restore": "bb260c1d273b77443019290ad7d306544b17e5160c6e2804361af44936eea010",
  "lab/participant/live-endpoint.mjs:LiveEndpointParticipant.async create": "c9455ccb2f2a294dc41eef79c822febee411f4f5fa89b8633fb2d70cc5ee0f48",
  "lab/participant/live-endpoint.mjs:LiveEndpointParticipant.async join": "1c521a447c1461d187e361ebd75fc1ef593b0a0e045749c94894dfc8e1713f21",
  "lab/participant/live-endpoint.mjs:LiveEndpointParticipant.async nurture": "31b52451ccd848248eba57e7d53b03f1433d3cce963a70965866cb81a4970322",
  "lab/participant/live-endpoint.mjs:LiveEndpointParticipant.async proposeHandoff": "fa78e367da3871d26c2bd41678f8f97e9ee83fd7dc4d1903a5ad6fa21a6eb52f",
  "lab/participant/quorum-endpoint.mjs:QuorumEndpointParticipant.async acceptMembership": "e64702f76bc6ba334d724f7b61a484a323f1849002c52058b066a11469a1e99d",
  "lab/participant/quorum-endpoint.mjs:QuorumEndpointParticipant.async approveGenesis": "90eb8881c8e2d4ec6ac1313195bb252a720608c06c164e07b98f16deb12c5775",
  "lab/participant/quorum-endpoint.mjs:QuorumEndpointParticipant.async approveProposal": "a3f2da562a3c45f5270051028226d98cfe7d21357e2bfcb5ec1eec2847271a5a",
  "lab/participant/quorum-endpoint.mjs:QuorumEndpointParticipant.async initializeKey": "e4209f6edd6a3c5dbac9b894069c6a8258b3f27e19b521db35b0b28f4ded60b2",
  "lab/transport/http-relay.mjs:HttpRelayTransport.async fetchRange": "2fea32c58dbc7b0359b2cdd553be744bd7e0dd32e80758657bad42f4ae01276e",
  "lab/transport/http-relay.mjs:HttpRelayTransport.async presence": "a2ab47d0f9fe341f6fe42f9400367601f754a7a77a362905c8fb9ea78f656233",
  "lab/transport/http-relay.mjs:HttpRelayTransport.async touchPresence": "da2523812ede8177581e226c2187844ec01b30b2e8e401caf73513ac77d406b2",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async #commitDocument": "902a580c69029e67a39654ae2706880f2f8eb721cd3904cde5a983508240adde",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async #enforceSigningPolicy": "2b376623aff631d1555df23656e8ead3c60b1d0400a48693874b99939491979a",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async acceptMembership": "bc2f4ccfeb241f37741fce36fc12048add2f296999ede685cc6696e15eeebe24",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async approveGenesis": "c9558a082057cff7062b6acc28792ba705c89b1e773dbe551487cd6fdb015257",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async approveProposal": "6440e7658638192b65109b0b571eae5ee82750c4d48cd6d788ce5813447cfbfb",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async commissionGenesis": "e9a5c3807c951011accc918720ac012d99abd5479b2c1d365085254d9135a00b",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async commitProposal": "3006cf3840fd1a62f69557bae4adfd1adcb92fe91835673c77591384a2088a58",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async expireAuthority": "18073543f3abce97064c0fcca3b39b7d295fca1f75fba21e980e174b8a33d2d9",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async initializeKey": "cb2b26ccd454414610ba31ec823f78842c7656329159aef36ecdc0021750f159",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async observeEvidence": "4d29f2ec39b827d99b9f2ea151f5cee7e422435c53d5219c6c0c4d60ae1517f7",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async removeAuthority": "41c4680e7a5012eee0baf2710def5acf40f43303e63789ddf3de08a31f3558a8",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async renewAuthority": "3722e235b587ec7df4f7d9d6f8de4809d96a81f17847b0b9baad50a52202b1cf",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async restore": "9141703bc9578853e9081cc7f72ab0470b70c08aba40e8ee49ebdfcfe100a464",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async syncEvidence": "a885f68a5a8ab38b3ce6761f64c6b4ce7485c9bf711d0f304d166ec72ded08f9",
  "lab/storage/durable-store.mjs:IndexedDbDurableStore.async #boundary": "a2e3c2479df99e07f5a8e103d624e5d3d1723a251d04b2a3904aa7c389d4a4a3",
  "lab/storage/durable-store.mjs:IndexedDbDurableStore.async #handle": "ca72458a984ab2fb78c69f848cb4b517e37e41e902090f509595e9a3003eb655",
  "lab/storage/durable-store.mjs:IndexedDbDurableStore.async #read": "938c30558307dbe5ca3eeecb374ed01d33765e0caac03dd3238fc909a6536eae",
  "lab/storage/durable-store.mjs:IndexedDbDurableStore.async #write": "6e59d8ef51010ac026c5c04b39ceecec56573c36195b8356d5b7cd8eb69b21ab",
  "lab/storage/durable-store.mjs:IndexedDbDurableStore.async read": "f6ed2c5981f05e62c09e7ef0d4f91c846e8de887b96d4a39592fc1dec2c25867",
  "lab/storage/durable-store.mjs:IndexedDbDurableStore.async write": "f02e6c785dc4e713ad27c42390ee3bd09d4dd75dc364bf89d1b59cb7efa9e753",
  "lab/storage/durable-store.mjs:MemoryDurableStore.async #boundary": "a2e3c2479df99e07f5a8e103d624e5d3d1723a251d04b2a3904aa7c389d4a4a3",
  "lab/storage/durable-store.mjs:MemoryDurableStore.async #read": "756db83fac5af2b2e1c9f8958051ebc1ace539ad5bbe441ea4d51a7079c52f37",
  "lab/storage/durable-store.mjs:MemoryDurableStore.async #write": "569fcb065e31b112eb6803c7bbc1ca0db37a141932420639a5b29496cb29d8cf",
  "lab/storage/durable-store.mjs:MemoryDurableStore.async read": "f6ed2c5981f05e62c09e7ef0d4f91c846e8de887b96d4a39592fc1dec2c25867",
  "lab/storage/durable-store.mjs:MemoryDurableStore.async write": "f02e6c785dc4e713ad27c42390ee3bd09d4dd75dc364bf89d1b59cb7efa9e753",
  "lab/storage/durable-store.mjs:export async function deleteDurableStore": "9057b9583f52c0d99700ef9888d8e4240c4b08b1f201e6d457e46d45b9fd11e3",
  "lab/storage/durable-store.mjs:export async function durableStoreExists": "34dc09e6919995df3acb6b181c08471473847bee7f5ccbcc45eef1bc0abfadf0",
  "lab/storage/confidential-counter-authority-store.mjs:IndexedDbCounterAuthority.static async open": "4864c2b519c0ab438e3ce18763a366326cf65193248512b4fb5a0b569a9501ff",
  "lab/storage/confidential-counter-authority-store.mjs:IndexedDbCounterAuthorityStore.async #handle": "9a0250815e2a6420dde01b0856f9519e2664c6ca3e63106bbca33dab424e87bd",
  "lab/storage/confidential-counter-authority-store.mjs:IndexedDbCounterAuthorityStore.async #inspect": "b8555e71f9280c48fdeb6abd7156eb4bc17892794599ec37d21c676f74ff5b85",
  "lab/storage/confidential-counter-authority-store.mjs:IndexedDbCounterAuthorityStore.async #loadOrCreateAuthorityCapability": "ed0816bae93aa8634f4f781cd69fd49486a7114ce828b973043916827c5ffce6",
  "lab/storage/confidential-counter-authority-store.mjs:IndexedDbCounterAuthorityStore.async #locked": "1fc1040a95c6a5e5ab7fa98bd037dc1d68d6f3839a21e7053e0e191b9e404dc5",
  "lab/storage/confidential-counter-authority-store.mjs:IndexedDbCounterAuthorityStore.async #read": "f9fff17dcd5bf3484765c989a21f9560f2c8a3d55ad4aa2712bc3c31b7cfd15b",
  "lab/storage/confidential-counter-authority-store.mjs:IndexedDbCounterAuthorityStore.async #transact": "fc9d6805e49dc6c78a4b6d2e6705d138b33297e805484caf350ae9f8694897e4",
  "lab/storage/confidential-counter-authority-store.mjs:IndexedDbCounterAuthorityStore.async inspect": "4ae71dd673300dffde02916e70919a643fea46ef80568ffcda47b6082e84e08d",
  "lab/storage/confidential-counter-authority-store.mjs:export async function deleteIndexedDbCounterAuthorityStore": "a93695008740657063bf261323caf4a6c14bbdacec02566ad9411319e05d705d",
  "lab/participant/webcrypto-key-store.mjs:WebCryptoKeyStore.async create": "90e2fe478a3274a25f758349b4c51d56e4294c7eb83227922db187cd8523bd10",
  "lab/participant/webcrypto-key-store.mjs:WebCryptoKeyStore.async describe": "9d661f5935f8294962baa05e0f1c09949eeaf5e3d406d2ba9c76b642f6dc044e",
  "lab/participant/webcrypto-key-store.mjs:WebCryptoKeyStore.async destroy": "edf94d35927f7f255d06545a80f396d8e28c57665f496f97f675c58231b38b4d",
  "lab/participant/webcrypto-key-store.mjs:WebCryptoKeyStore.async sign": "885af767bff7d518d989fa3e1ceacab21f63b7932f1d211b3e0e1f2565b69307",
  "lab/participant/webcrypto-key-store.mjs:export async function assertNonExtractableSigningKey": "de8edbb13155073dfc171252ffbee8736d5e0cae5644a96b72d87bb98961f556",
  "src/confidential/counter.mjs:LinearizableCounterAuthority.async #reserveRange": "a4fa539e429c70b23fabb2bf2c9d2543aca37a536a20811ee676aef9c2d5f251",
  "src/confidential/counter.mjs:LinearizableCounterAuthority.async inspect": "4ae71dd673300dffde02916e70919a643fea46ef80568ffcda47b6082e84e08d",
  "src/confidential/counter.mjs:LinearizableCounterAuthority.async reserveRange": "525850bdd3b4f4054b6a1ac9d937f8d79f4ae088df15e29640431ecb7dde9db7",
  "src/confidential/counter.mjs:LinearizableCounterAuthority.async retire": "48e627c8e41e70337806ef9819d6b87c14843d638bb3cdce4a9114b950ae1cab",
  "src/confidential/counter.mjs:LinearizableCounterAuthority.static async create": "0c795819f5347485c5c4f741b58c4e226bffdea13b574c26a41e84f8a07b5485",
  "src/confidential/counter.mjs:MemoryCounterAuthorityStore.async #inspect": "1d4e930815ceeb876ec2a15bb16de70718198a774cf113b305798942e13db0f4",
  "src/confidential/counter.mjs:MemoryCounterAuthorityStore.async #transact": "33c513b608f341cf8948b80fa425548ab9eed1871c4e7749da5eee2e07c52c80",
  "src/confidential/counter.mjs:MemoryCounterAuthorityStore.async inspect": "4ae71dd673300dffde02916e70919a643fea46ef80568ffcda47b6082e84e08d",
  "src/confidential/counter.mjs:export async function generateCounterAuthorityKeyMaterial": "b752f2573585ad23377a5017ff159eb8cbec022a1bc3db099202b7e34f54bcd7",
  "src/confidential/counter.mjs:export async function inspectCounterAuthority": "d6a55a622dbdd7db04edfdd1aa52f9ceec45886f808f5abf8d7f05e709661a5c",
  "src/confidential/counter.mjs:export async function observeCounterAuthorityEquivocation": "c2f3d085d14c4898cad28ad3a055626f27c6576cb019b52ecae89f75929ee5b5",
  "src/confidential/counter.mjs:export async function retireCounterAuthority": "55279d65da7edbb1179605b5810d8bc1215c50722fd3a9b1e6473a04e8a5ae1b",
  "src/confidential/keys.mjs:export async function generateCustodianEncryptionKeyPair": "b6f70870ee3f1d6d504873a2b7aeb807c79da99f8aab01d9fcb1ac573fff1831",
  "src/confidential/keys.mjs:export async function generateStagingEpochKey": "05f580c7b436e42dd438ab2b6b24a9082b59a32ee9dad4eb0c8ecf6e2849787c",
  "src/confidential/recovery.mjs:MemoryConfidentialEpochStore.async #commitActive": "7ffcf051f35d2621aac4cf63316b9b605f5cf584c1ef2c73862194493d5a5a3b",
  "src/distributed/quorum-counter-store.mjs:QuorumCounterAuthorityStore.async #inspect": "0b1e2fdd548f2d70c5fa9868ca98ac9112a39a83fd9b3a1e8b06faf31c3a7245",
  "src/distributed/quorum-counter-store.mjs:QuorumCounterAuthorityStore.async #transact": "7a8ab30f821272d011b3bbbaccac22c017e7b714601ac9545604faa03eb57a38",
  "src/state/recovery.mjs:MemoryContentAddressedStore.async #commitActive": "23526651a15fe38724b2eb087b59483fa3aa1ade828f9a4c251cefbb347b24ea",
  "src/state/recovery.mjs:MemoryContentAddressedStore.async #get": "3d4a8d475892e6c704b02199108a3cdd847b33fae23d63c67ca0c4833ba2237b",
  "src/state/recovery.mjs:MemoryContentAddressedStore.async #inventory": "baa05fb5c614ec426ae60cbb78be718b1b2a5b963c4079d5feed43b564669625",
  "src/state/recovery.mjs:MemoryContentAddressedStore.async #put": "74aca779a34f7e0a08b39f0825b4a94ea7641edc19e6b09ef2b02c5a6f432145",
  "src/state/recovery.mjs:MemoryContentAddressedStore.async #readActive": "195b972fed4bb1852984a0c8cdb9c842ea796a8ba3055710ca20bbd1f77f1df6",
  "src/state/recovery.mjs:MemoryContentAddressedStore.async get": "030fe11c69ea251f77b5ee11d8a920e38203d489b6831b00b1014dfc7c19d3d8",
  "src/state/recovery.mjs:MemoryContentAddressedStore.async inventory": "b716df591d8a1c6a5d248c5e48ebf240932f55fc4520dd36da3a5fd2e2bd1c42",
  "src/state/recovery.mjs:MemoryContentAddressedStore.async put": "11fa19b57ba2d4f9b2a18836b19c2d7727066d058e3bf9237f0ac1d624514b89",
  "src/state/recovery.mjs:MemoryContentAddressedStore.async readActive": "02412172dce17d4a466793deabc089196d40bd5cbfbb869aaa2dd2ac28877ed7",
  "src/state/recovery.mjs:ReplicaRecoveryAdapter.async inventory": "b716df591d8a1c6a5d248c5e48ebf240932f55fc4520dd36da3a5fd2e2bd1c42",
  "src/state/recovery.mjs:ReplicaRecoveryAdapter.async readChunk": "859cc82184234b15f349e45c0fe9d53a09146a05acfde16d4fd19e9e3684a0c8",
  "src/transport/chunk-data-plane.mjs:RelayChunkRecoveryAdapter.async #loadFrames": "54708a6560e0e7e59fcf8935444d440f2efc887f3a4f84888487014495536506",
  "src/transport/chunk-data-plane.mjs:RelayChunkRecoveryAdapter.async inventory": "2d46193e7fb518c6f81a5c932b50710ad9b31d0871da5c3092b8e1fdfc41cc0f",
  "src/transport/chunk-data-plane.mjs:RelayChunkRecoveryAdapter.async readChunk": "94fe133d82c2e1c8dccf35daa5c4c31315b7c9003c3dfb2c8968ae34444cd1bb",
  "src/continuity.mjs:export async function createContinuityAuthority": "4e27da7380ce0fe1ede42a239dc7fc38ba2404f548e86b886de662a2a5528b75",
  "src/continuity.mjs:export async function handoffContinuity": "547901d2b13e6634d9b6419496be097bbde4fc25998acd6c5d033e924fbd62dd",
  "lab/transport/webrtc-peer.mjs:ManualWebRtcParticipantTransport.static async createOffer": "9ec5d2cdbcb4759cce808bc5f2096cf66693189b50cd66a119ff5194eab4d2aa",
  "lab/transport/webrtc-peer.mjs:ManualWebRtcParticipantTransport.static async acceptOffer": "312dca19733fd7464d95ccb0ffc5e1909229d2849eff5f319faa34b9bce46626",
  "lab/transport/webrtc-peer.mjs:ManualWebRtcParticipantTransport.async complete": "bad59957d4f2e1e69468d3bb90116d9cfcee18497e5128e2f28438d32aae3769",
  "lab/transport/webrtc-peer.mjs:ManualWebRtcParticipantTransport.async ready": "9cce22bbcfa0dba396f69810dd8d8b38d4067743da66ef5850e880e0dbdd6929",
  "lab/transport/webrtc-peer.mjs:ManualWebRtcParticipantTransport.async publish": "09b45f9c220f20bbbf716f789b48fb194d03002d16f7410fa5bd057ed071535b",
  "lab/transport/webrtc-peer.mjs:ManualWebRtcParticipantTransport.async fetchRange": "35ad0b7680d8d04498ba958c31aafaa7e6cf1a3d7d6f1b2336977ea4543b04d9",
  "lab/transport/webrtc-peer.mjs:ManualWebRtcParticipantTransport.async touchPresence": "7409b9b1176a28d5f8c847220e87eb43b35526c12f2342aae2af7b6e0314ce51",
  "lab/transport/webrtc-peer.mjs:ManualWebRtcParticipantTransport.async presence": "8903f54681ed29ce7bc6f9e40b02102cdd707cd5d5ccb4ddce50c13c861aa8f9"
});
const CLASSIFICATION_TRANSITIVE_DEPENDENCIES = Object.freeze({
  "lab/transport/webrtc-peer.mjs:ManualWebRtcParticipantTransport.async publish":
    Object.freeze(["decodeRelayMessageBytes"])
});
assert.deepEqual(
  Object.keys(CLASSIFICATION_DIGESTS).sort(),
  registry.classifications
    .map(({ file, entrypoint }) => `${file}:${entrypoint}`)
    .sort(),
  "every and only classified entrypoint must have an exact verifier-owned digest"
);

// Exact reviewed ownership-prelude language. Any syntax or sequencing change before
// the first suspension requires an explicit verifier-policy review and digest update.
const OWNERSHIP_PRELUDE_DIGESTS = Object.freeze({
  "cli/node-authority.mjs:export async function signNodeAuthority": "0a2da011598ab831937e11877798257e6979a5f04eb8b7de2e1ca90a5356e44d",
  "lab/participant/live-endpoint.mjs:LiveEndpointParticipant.async acceptHandoff": "7b71f3d8d456ca81d2a96dfd06a43f3462a38b3b0888972b6f8e1a8a4d7580e9",
  "lab/participant/webcrypto-key-store.mjs:async function signBytes": "3c9e2428f10143ee1d2de0cab9df0c2b4be4b85f96b77e42352cb7829fd5373f",
  "lab/storage/durable-document.mjs:export async function replayDurableDocument": "56382ef1faf80912cd2601b6db12666db1d466b3d434bab8f365c25f43d2238e",
  "lab/storage/durable-store.mjs:DurableQuorumEndpoint.async #signDurably": "c0c4ab656caa62057cd19e1d99cac59be75d7bac5dde9ec86b49e36b08853f88",
  "lab/transport/http-relay.mjs:HttpRelayTransport.async publish": "baa831dacb7bb10597ebb630478652ccf458166fc2ee8c8ec565cb0dfb007e3f",
  "src/confidential/keys.mjs:export async function importCustodianPublicKey": "5dcd7c8bded68f815bd4021deee3a52e4c6ac56aad82c437029b5944e7ef03fe",
  "src/confidential/keys.mjs:export async function unwrapEpochKey": "85eeef0f63a31f4113bf157a2626b1336281524a622065d11922d5f8d9d9bb35",
  "src/confidential/keys.mjs:export async function wrapEpochKey": "f0838fa18fea69dc30eff46796ea5fde2bde8cf667de8931debac47f6195c82a",
  "src/confidential/package.mjs:async function decryptConfidentialPackageWithEpochKey": "957bb6f75456f78ae54a3ca86d2eac72debb9218b8e70aef986af565537b61b7",
  "src/confidential/package.mjs:export async function aesGcmKnownAnswer": "5849b2fc94078351895e037203d30eb1548fdc1bb0038c8fa5f123ae217f4eed",
  "src/confidential/package.mjs:export async function createConfidentialPackage": "1ea86c69c6d4790bc86390781f77a12124c1c818d0f72ac21abb4e49919ebce4",
  "src/confidential/package.mjs:export async function decryptConfidentialPackage": "32ba2bff25601dff5824fae19457178729df2853009887823560e6c718e61407",
  "src/confidential/recovery.mjs:export async function createConfidentialStatePackage": "7d961326985c0690eaf47c46ecaf26238fa94f3b5bb4ea8e2161827beb75486d",
  "src/confidential/recovery.mjs:export async function recoverAndDecryptConfidentialState": "162b319126818e66edb5bb523a3b53737387e4fd61affc2dbf273de7fb0e7d8d",
  "src/confidential/recovery.mjs:export async function rotateConfidentialState": "d4809283cf035f4f668af691d30d1330b7edd01ca3354188d57e8c98c38b78f5",
  "src/state/recovery.mjs:export async function recoverStatePackage": "bcca8331c681c44960bab8425a473503eeb8919d49f8034cad56a678c3bc3aa6",
  "src/transport/chunk-data-plane.mjs:export async function publishStateChunk": "834a7fee1833a22ae4d55a1e1d024ce8b46493a62c0047483ee50abb350b4e84",
  "src/transport/chunk-data-plane.mjs:export async function publishStatePackageChunks": "c101407df7bd62263823c2c91d7edeef82336c6247db778eabfe68ab8be5452d",
  "src/continuity.mjs:export async function createContinuity": "7c3f5c2d75b2928e355d032b27062c1baf56cadc73aa5e87f3610863a9fa38a1",
  "src/continuity.mjs:export async function continueContinuity": "5ffded5a3705401e8e2aff9cf0f6cd0c633827ca4097119356fb84b7ea38a715",
  "src/placement/lineage-controller.mjs:export async function commitLineagePlacementGeneration": "a7dc924670d449ec0ee7faf79e9c2d22851c7e771b8f10c1d987505c6ef720f5"
});
assert.deepEqual(
  Object.keys(OWNERSHIP_PRELUDE_DIGESTS).sort(),
  [...REQUIRED_ENTRYPOINTS].sort(),
  "every and only verifier-required direct audit must have an exact prelude digest"
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function assertSupportedOwnershipPrelude(functionNode, boundary, file = "module") {
  const forbiddenSyntax = new Set([
    "ClassDeclaration",
    "ClassExpression",
    "FunctionDeclaration",
    "FunctionExpression",
    "ImportExpression",
    "TaggedTemplateExpression",
    "YieldExpression"
  ]);
  const containsSuspension = (rootNode) => {
    let found = false;
    full(rootNode, (node) => {
      if (
        node.type === "AwaitExpression" ||
        node.type === "YieldExpression" ||
        (node.type === "ForOfStatement" && node.await)
      ) {
        found = true;
      }
    });
    return found;
  };
  const isDestructuringPattern = (node) =>
    node?.type === "ArrayPattern" || node?.type === "ObjectPattern";
  const inspect = (rootNode) => full(rootNode, (node) => {
    if (
      node.type === "ImportExpression" ||
      (
        node.type === "Identifier" &&
        ["AsyncFunction", "Function", "GeneratorFunction", "eval"].includes(node.name)
      ) ||
      (
        node.type === "MemberExpression" &&
        (
          (!node.computed && ["AsyncFunction", "Function", "GeneratorFunction", "eval"].includes(node.property?.name)) ||
          (node.computed && ["AsyncFunction", "Function", "GeneratorFunction", "eval"].includes(node.property?.value))
        )
      )
    ) {
      assert.fail(`${file}: dynamic code is forbidden in security entrypoints`);
    }
    if (
      node.start < boundary &&
      (
        (
          node.type === "VariableDeclarator" &&
          isDestructuringPattern(node.id) &&
          node.init &&
          containsSuspension(node.init)
        ) ||
        (
          node.type === "AssignmentExpression" &&
          isDestructuringPattern(node.left) &&
          containsSuspension(node.right)
        ) ||
        (isDestructuringPattern(node) && containsSuspension(node))
      )
    ) {
      assert.fail(`${file}: suspension combined with destructuring is forbidden in ownership preludes`);
    }
    if (node.end > boundary) return;
    if (forbiddenSyntax.has(node.type)) {
      assert.fail(`${file}: unsupported ownership-prelude syntax ${node.type}`);
    }
  });
  for (const parameter of functionNode.params) inspect(parameter);
  inspect(functionNode.body);
}

function patternHasName(pattern, name) {
  if (!pattern) return false;
  if (pattern.type === "Identifier") return pattern.name === name;
  if (pattern.type === "RestElement") return patternHasName(pattern.argument, name);
  if (pattern.type === "AssignmentPattern") return patternHasName(pattern.left, name);
  if (pattern.type === "ArrayPattern") {
    return pattern.elements.some((element) => patternHasName(element, name));
  }
  if (pattern.type === "ObjectPattern") {
    return pattern.properties.some((property) => patternHasName(
      property.type === "RestElement" ? property.argument : property.value,
      name
    ));
  }
  return false;
}

function writeTargetHasName(target, name) {
  if (target?.type === "VariableDeclaration") {
    return target.declarations.some(({ id }) => patternHasName(id, name));
  }
  return patternHasName(target, name);
}

function topLevelFunction(ast, name, exportedOnly = false) {
  for (const statement of ast.body) {
    if (exportedOnly && statement.type !== "ExportNamedDeclaration") continue;
    const declaration = statement.type === "ExportNamedDeclaration"
      ? statement.declaration
      : statement;
    if (declaration?.type === "FunctionDeclaration" && declaration.id?.name === name) {
      return declaration;
    }
  }
  return null;
}

function topLevelImport(ast, name) {
  for (const statement of ast.body) {
    if (statement.type !== "ImportDeclaration") continue;
    const specifier = statement.specifiers.find(({ local }) => local.name === name);
    if (specifier) return { source: statement.source.value, specifier };
  }
  return null;
}

export function assertImmutablePrimitiveBinding(ast, functionNode, name, file) {
  for (const parameter of functionNode.params) {
    assert.equal(patternHasName(parameter, name), false, `${file}: ${name} parameter shadows primitive`);
  }
  full(functionNode.body, (node) => {
    if (
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression"
    ) {
      if (node.id?.name === name) {
        assert.fail(`${file}: ${name} nested function shadows primitive`);
      }
      for (const parameter of node.params) {
        assert.equal(
          patternHasName(parameter, name),
          false,
          `${file}: ${name} nested parameter shadows primitive`
        );
      }
    }
    if (node.type === "VariableDeclarator") {
      assert.equal(patternHasName(node.id, name), false, `${file}: ${name} local shadows primitive`);
    }
    if (
      (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") &&
      node.id?.name === name
    ) {
      assert.fail(`${file}: ${name} local declaration shadows primitive`);
    }
    if (node.type === "CatchClause") {
      assert.equal(patternHasName(node.param, name), false, `${file}: ${name} catch binding shadows primitive`);
    }
    if (node.type === "AssignmentExpression") {
      assert.equal(patternHasName(node.left, name), false, `${file}: ${name} primitive is reassigned`);
    }
    if (node.type === "UpdateExpression" && node.argument?.name === name) {
      assert.fail(`${file}: ${name} primitive is updated`);
    }
    if (
      (node.type === "ForInStatement" || node.type === "ForOfStatement") &&
      writeTargetHasName(node.left, name)
    ) {
      assert.fail(`${file}: ${name} primitive is a loop write target`);
    }
  });
  full(ast, (node) => {
    if (node.type === "AssignmentExpression" && patternHasName(node.left, name)) {
      assert.fail(`${file}: ${name} top-level primitive binding is mutable`);
    }
    if (node.type === "UpdateExpression" && node.argument?.name === name) {
      assert.fail(`${file}: ${name} top-level primitive binding is mutable`);
    }
    if (
      (node.type === "ForInStatement" || node.type === "ForOfStatement") &&
      writeTargetHasName(node.left, name)
    ) {
      assert.fail(`${file}: ${name} top-level primitive binding is mutable`);
    }
  });
}

async function verifiedPrimitiveCallStarts({
  ast,
  entry,
  functionNode,
  names,
  purpose,
  source
}) {
  const filePolicy = OWNERSHIP_PROVENANCE[entry.file];
  assert.ok(filePolicy, `${entry.file}: no verifier-owned primitive provenance policy`);
  const starts = [];
  for (const name of names) {
    const provenance = filePolicy[name];
    assert.ok(provenance, `${entry.file}: ${name} has no verifier-owned ${purpose} provenance`);
    const [kind, expectedSource, expectedImported, expectedDefinitionDigest] = provenance;
    let definitionFile = entry.file;
    let definitionSource = source;
    let definitionNode = null;
    if (kind === "local") {
      definitionNode = topLevelFunction(ast, name);
      assert.ok(definitionNode, `${entry.file}: ${name} must be a top-level function`);
    } else {
      assert.equal(kind, "import", `${entry.file}: unknown provenance kind for ${name}`);
      const binding = topLevelImport(ast, name);
      assert.ok(binding, `${entry.file}: ${name} must be an imported immutable binding`);
      assert.equal(binding.source, expectedSource, `${entry.file}: ${name} import source drift`);
      assert.equal(binding.specifier.type, "ImportSpecifier", `${entry.file}: ${name} named import required`);
      assert.equal(binding.specifier.imported.name, expectedImported, `${entry.file}: ${name} import target drift`);
      const definitionUrl = new URL(expectedSource, new URL(entry.file, root));
      definitionFile = definitionUrl.href.slice(root.href.length);
      definitionSource = await readFile(definitionUrl, "utf8");
      const definitionAst = parseSecurityModule(definitionSource);
      definitionNode = topLevelFunction(definitionAst, expectedImported, true);
      assert.ok(definitionNode, `${definitionFile}: missing exported primitive ${expectedImported}`);
    }
    assert.equal(
      sha256(definitionSource.slice(definitionNode.start, definitionNode.end)),
      expectedDefinitionDigest,
      `${definitionFile}: ${name} ${purpose} implementation drift`
    );
    assert.equal(
      sha256(definitionSource),
      OWNERSHIP_MODULE_DIGESTS[definitionFile],
      `${definitionFile}: ownership module closure drift`
    );
    assertImmutablePrimitiveBinding(ast, functionNode, name, entry.file);
    let matchedCalls = 0;
    const collect = (rootNode) => full(rootNode, (node) => {
      if (node.type === "CallExpression" && node.callee?.type === "Identifier" && node.callee.name === name) {
        starts.push(node.start);
        matchedCalls += 1;
      }
    });
    for (const parameter of functionNode.params) collect(parameter);
    collect(functionNode.body);
    assert.ok(matchedCalls > 0, `${entry.file}: missing verifier-bound ${name} call`);
  }
  return [...new Set(starts)].sort((left, right) => left - right);
}

async function verifiedOwnershipCallStarts(options) {
  return verifiedPrimitiveCallStarts({
    ...options,
    names: options.entry.ownership_primitives,
    purpose: "ownership"
  });
}

async function verifiedEffectSummaryCallStarts(options) {
  return verifiedPrimitiveCallStarts({
    ...options,
    names: options.entry.effect_summary_primitives ?? [],
    purpose: "effect-summary"
  });
}

assert.deepEqual(
  [...registry.export_scopes].sort(),
  [...SECURITY_EXPORT_SCOPES].sort(),
  "security export scopes are verifier-owned, not registry-extensible"
);
const registeredEntrypoints = new Set(
  registry.entries.map(({ file, entrypoint }) => `${file}:${entrypoint}`)
);
for (const required of REQUIRED_ENTRYPOINTS) {
  assert.ok(registeredEntrypoints.has(required), `missing verifier-required entrypoint ${required}`);
}

export function tokenizeJavaScript(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }
    if (character === "/" && next === "/") {
      index = source.indexOf("\n", index + 2);
      if (index === -1) break;
      continue;
    }
    if (character === "/" && next === "*") {
      const close = source.indexOf("*/", index + 2);
      assert.notEqual(close, -1, "unterminated block comment");
      index = close + 2;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      const quote = character;
      index += 1;
      let escaped = false;
      while (index < source.length) {
        const current = source[index];
        index += 1;
        if (escaped) escaped = false;
        else if (current === "\\") escaped = true;
        else if (current === quote) break;
      }
      continue;
    }
    const identifier = source.slice(index).match(/^[A-Za-z_$][\w$]*/u)?.[0];
    if (identifier) {
      tokens.push({ end: index + identifier.length, start: index, value: identifier });
      index += identifier.length;
      continue;
    }
    tokens.push({ end: index + 1, start: index, value: character });
    index += 1;
  }
  return tokens;
}

function tokenSequenceIndex(tokens, sequence, start = 0) {
  for (let index = start; index <= tokens.length - sequence.length; index += 1) {
    if (sequence.every((value, offset) => tokens[index + offset].value === value)) return index;
  }
  return -1;
}

function markerTokens(marker) {
  return tokenizeJavaScript(marker).map(({ value }) => value);
}

async function runtimeModules(relativeDirectory) {
  const discovered = [];
  const entries = await readdir(new URL(`${relativeDirectory}/`, root), {
    withFileTypes: true
  });
  for (const entry of entries) {
    const relative = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) discovered.push(...await runtimeModules(relative));
    else if (entry.isFile() && entry.name.endsWith(".mjs")) discovered.push(relative);
  }
  return discovered;
}

export function postAwaitBorrowedIdentifiers(source, forbidden, ownershipPrimitives = []) {
  return analyzePostAwaitBorrowedIdentifiers(source, forbidden, ownershipPrimitives);
}

const discoveredExports = new Set();
for (const file of SECURITY_EXPORT_SCOPES) {
  const source = await readFile(new URL(file, root), "utf8");
  const ast = parseSecurityModule(source);
  for (const entrypoint of discoverExportedAsyncSecurityEntrypoints(ast)) {
    discoveredExports.add(`${file}:${entrypoint}`);
  }
}
const classifiedExports = new Set([
  ...registry.entries
    .map(({ file, entrypoint }) => `${file}:${entrypoint}`)
    .filter((entrypoint) => discoveredExports.has(entrypoint)),
  ...registry.classifications.map(({ file, entrypoint }) => `${file}:${entrypoint}`)
]);
assert.deepEqual(
  [...classifiedExports].sort(),
  [...discoveredExports].sort(),
  "every exported async security function and class method must be audited or explicitly classified"
);
const CLASSIFICATION_MODES = new Set([
  "branded-immutable-capability",
  "delegates-to-audited-boundary",
  "module-private-owned-state",
  "no-borrowed-mutable-input"
]);
for (const classification of registry.classifications) {
  assert.ok(CLASSIFICATION_MODES.has(classification.mode), "recognized classification mode required");
  assert.ok(
    typeof classification.reason === "string" && classification.reason.length >= 20,
    `${classification.file}: classification requires a concrete review reason`
  );
  const source = await readFile(new URL(classification.file, root), "utf8");
  const ast = parseSecurityModule(source);
  const functionNode = findSecurityEntrypoint(ast, classification.entrypoint);
  const classificationKey = `${classification.file}:${classification.entrypoint}`;
  assert.ok(functionNode, `${classificationKey}: classified entrypoint is missing`);
  assert.equal(functionNode.async, true, `${classificationKey}: classification requires async code`);
  if (classification.mode === "module-private-owned-state") {
    assert.match(
      classification.entrypoint,
      /\.(?:static )?async /u,
      `${classificationKey}: module-private state classification requires a class method`
    );
  }
  if (classification.mode === "no-borrowed-mutable-input") {
    for (const parameter of functionNode.params) {
      const binding = parameter.type === "AssignmentPattern" ? parameter.left : parameter;
      assert.equal(
        binding.type,
        "Identifier",
        `${classificationKey}: no-borrowed-input classification permits scalar bindings only`
      );
    }
  }
  if (classification.mode === "delegates-to-audited-boundary") {
    let callCount = 0;
    full(functionNode.body, (node) => {
      if (node.type === "CallExpression") callCount += 1;
    });
    assert.ok(callCount > 0, `${classificationKey}: delegation classification requires a call`);
  }
  assert.equal(
    sha256(source.slice(functionNode.start, functionNode.end)),
    CLASSIFICATION_DIGESTS[classificationKey],
    `${classificationKey}: classified function drift requires a fresh security review`
  );
  assert.equal(
    sha256(source),
    OWNERSHIP_MODULE_DIGESTS[classification.file],
    `${classification.file}: classified module drift requires a fresh security review`
  );
  const transitiveDependencies = CLASSIFICATION_TRANSITIVE_DEPENDENCIES[classificationKey];
  if (transitiveDependencies) {
    await verifiedPrimitiveCallStarts({
      ast,
      entry: classification,
      functionNode,
      names: transitiveDependencies,
      purpose: "transitive validator",
      source
    });
  }
}

const RAW_DURABLE_CAPABILITY_CONSUMERS = new Set(["lab/storage/durable-store.mjs"]);
for (const file of (await Promise.all(
  ["cli", "lab", "sdk", "src"].map(runtimeModules)
)).flat()) {
  const source = await readFile(new URL(file, root), "utf8");
  const identifiers = new Set(tokenizeJavaScript(source).map(({ value }) => value));
  if (
    (
      identifiers.has("readPrivateDurableDocument") ||
      identifiers.has("commitPrivateDurableDocument") ||
      identifiers.has("durableStoreCapability")
    ) &&
    !RAW_DURABLE_CAPABILITY_CONSUMERS.has(file)
  ) {
    assert.fail(`${file}: raw durable capability escaped its endpoint/storage modules`);
  }
}

for (const entry of registry.entries) {
  const source = await readFile(new URL(entry.file, root), "utf8");
  const ast = parseSecurityModule(source);
  const functionNode = findSecurityEntrypoint(ast, entry.entrypoint);
  assert.ok(functionNode, `${entry.file}: missing ${entry.entrypoint}`);
  assert.ok(
    Array.isArray(entry.ownership_primitives) && entry.ownership_primitives.length > 0,
    `${entry.file}: allowlisted ownership primitive is required`
  );
  for (const primitive of entry.ownership_primitives) {
    assert.ok(
      DEEP_OWNERSHIP_PRIMITIVES.has(primitive),
      `${entry.file}: unrecognized ownership primitive ${primitive}`
    );
  }
  const ownershipCallStarts = await verifiedOwnershipCallStarts({
    ast,
    entry,
    functionNode,
    source
  });
  const effectSummaryCallStarts = await verifiedEffectSummaryCallStarts({
    ast,
    entry,
    functionNode,
    source
  });
  const suspension = findFirstSuspension(functionNode);
  assert.ok(suspension, `${entry.file}: security entrypoint must suspend`);
  const entryKey = `${entry.file}:${entry.entrypoint}`;
  const prelude = source.slice(functionNode.start, suspension.end);
  assert.equal(
    sha256(prelude),
    OWNERSHIP_PRELUDE_DIGESTS[entryKey],
    `${entry.file}: reviewed ownership prelude drift`
  );
  assertSupportedOwnershipPrelude(functionNode, suspension.end, entry.file);
  const audit = analyzeFunctionOwnership(
    functionNode,
    entry.post_await_forbidden,
    ownershipCallStarts,
    effectSummaryCallStarts
  );
  const body = source.slice(functionNode.body.start + 1, functionNode.body.end - 1);
  const bodyTokens = tokenizeJavaScript(body);
  const ownershipPositions = entry.ownership_primitives.map((primitive) =>
    tokenSequenceIndex(bodyTokens, markerTokens(primitive))
  );
  assert.ok(
    ownershipPositions.every((position) => position !== -1),
    `${entry.file}: missing allowlisted ownership primitive call`
  );
  assert.ok(
    ownershipCallStarts.length >= entry.ownership_primitives.length,
    `${entry.file}: ownership calls must resolve to verifier-pinned bindings`
  );
  assert.notEqual(audit.firstAwait, -1, `${entry.file}: security entrypoint must be async`);
  assert.ok(
    ownershipPositions.every((position) =>
      functionNode.body.start + 1 + bodyTokens[position].start < audit.boundary),
    `${entry.file}: ${entry.entrypoint} reaches await before transitive ownership`
  );
  assert.ok(
    Array.isArray(entry.post_await_forbidden) && entry.post_await_forbidden.length > 0,
    `${entry.file}: post-await borrowed-identifier policy is required`
  );
  const firstAwaitBoundary = audit.boundary;
  assert.notEqual(
    firstAwaitBoundary,
    -1,
    `${entry.file}: first await statement must have an auditable boundary`
  );
  assert.deepEqual(
    audit.identifiers,
    [],
    `${entry.file}: ${entry.entrypoint} re-reads borrowed identifiers after its first await`
  );
  const testSource = await readFile(new URL(entry.test_file, root), "utf8");
  assert.match(
    testSource,
    new RegExp(entry.test_marker.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
    `${entry.file}: missing linked hostile-mutation regression`
  );
}

for (const [file, expectedDigest] of Object.entries(SYNC_TRUST_BOUNDARY_MODULE_DIGESTS)) {
  const source = await readFile(new URL(file, root), "utf8");
  assert.equal(
    sha256(source),
    expectedDigest,
    `${file}: synchronous trust boundary drift requires a fresh security review`
  );
}

console.log(
  `MortalOS async security boundary audit: PASS (${registry.entries.length} direct / ` +
  `${discoveredExports.size} auto-discovered exports and class methods)`
);
