import { readFileSync, writeFileSync } from "node:fs";
import {
  commitConfidentialPlacementJournal,
  loadConfidentialPlacementJournal
} from "../lab/placement/confidential-controller.mjs";

const [action, directory, documentPath] = process.argv.slice(2);
if (action === "commit") {
  const result = commitConfidentialPlacementJournal({
    directory,
    journal_bytes: new Uint8Array(readFileSync(documentPath))
  });
  process.stdout.write(JSON.stringify(result));
} else if (action === "load") {
  const restored = loadConfidentialPlacementJournal(directory);
  writeFileSync(documentPath, restored.journal_bytes);
  process.stdout.write(JSON.stringify({
    generation: restored.generation,
    journal_id: restored.journal_id,
    status: "loaded"
  }));
} else {
  throw new Error("commit or load action required");
}
