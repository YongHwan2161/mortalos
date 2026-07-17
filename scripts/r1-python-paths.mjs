import { fileURLToPath } from "node:url";

export function r1PythonArguments(baseUrl = import.meta.url) {
  return [
    fileURLToPath(new URL("../r1/python/verify.py", baseUrl)),
    fileURLToPath(new URL("../test/vectors/r1-operations.json", baseUrl))
  ];
}
