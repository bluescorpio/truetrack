import fs from "fs";
import path from "path";

let loaded = false;

/** Load repo-root .env into process.env without overriding variables already set. */
export function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env.local"),
    path.resolve(process.cwd(), "../.env"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    applyEnvFile(fs.readFileSync(file, "utf8"));
  }
}

function applyEnvFile(text: string): void {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
