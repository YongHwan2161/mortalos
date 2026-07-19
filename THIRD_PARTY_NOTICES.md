# Third-Party Dependency Notices

MortalOS source code is licensed under Apache-2.0. The locked npm dependency graph also contains third-party packages under their own terms.

| Package | Locked version | Use | License |
|---|---:|---|---|
| `@noble/curves` | 2.2.0 | Portable strict Ed25519 verification | MIT |
| `@noble/hashes` | 2.2.0 | Direct portable SHA-256 implementation and experimental Lab evidence digest | MIT |
| `ajv` | 8.20.0 | Development-only differential JSON Schema checks | MIT |
| `esbuild` | 0.28.1 | Development-only browser bundling for portability verification and the static Lab build | MIT |
| `playwright` / `playwright-core` | 1.61.1 | Development-only Chromium differential and Lab acceptance verification | Apache-2.0 |
| `qrcode-generator` | 1.4.4 | Local-only private join-link QR rendering | MIT |
| `wrangler` | 4.111.0 | Development-only Cloudflare Pages deployment | MIT OR Apache-2.0 |

This table records the direct runtime dependencies and material development/transitive dependencies used by the current locked build. It is not a replacement for the license files and metadata shipped by those packages. Run `npm ci` against `package-lock.json` to reconstruct the reviewed graph; review this notice again whenever the lockfile changes.

The deployable static Lab includes [`lab/THIRD_PARTY_LICENSES.txt`](lab/THIRD_PARTY_LICENSES.txt), containing the complete copyright and MIT permission text for the bundled Noble and QR generator packages.

No dataset, model weight, font, image, music, or third-party trademark asset is distributed by the current repository.
