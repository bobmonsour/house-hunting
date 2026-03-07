import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default function () {
  try {
    const raw = readFileSync(join(__dirname, "mutableState.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
