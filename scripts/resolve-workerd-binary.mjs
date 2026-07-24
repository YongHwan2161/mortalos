import { stat } from "node:fs/promises";
import { resolve } from "node:path";

export async function resolveWindowsWorkerdBinary(root) {
  const workerdRelativePath = ["@cloudflare", "workerd-windows-64", "bin", "workerd.exe"];
  const candidates = [
    resolve(
      root,
      "node_modules",
      "@cloudflare",
      "vitest-pool-workers",
      "node_modules",
      ...workerdRelativePath
    ),
    resolve(root, "node_modules", ...workerdRelativePath)
  ];

  for (const candidate of candidates) {
    try {
      await stat(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error("installed workerd Windows binary was not found");
}
