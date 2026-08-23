import { readFile } from "node:fs/promises";
import { lockPlacementAdmissionSignerProfile } from "../lab/placement/admission-signer-profile.mjs";

const [statePath, profilePath] = process.argv.slice(2);
if (!statePath || !profilePath) throw new Error("state and profile paths are required");

try {
  const result = await lockPlacementAdmissionSignerProfile({
    path: statePath,
    profile_bytes: new Uint8Array(await readFile(profilePath))
  });
  process.stdout.write(`${JSON.stringify({
    profile_id: result.profile_id,
    status: result.status
  })}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    code: error?.code ?? "E_PLACEMENT_ADMISSION_SIGNER_PROFILE_CHILD",
    detail: error?.detail ?? error?.message ?? null
  })}\n`);
  process.exitCode = 1;
}
