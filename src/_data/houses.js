import { readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const housesDir = join(__dirname, "houses");

export default function () {
  try {
    const files = readdirSync(housesDir).filter((f) => f.endsWith(".json"));
    return files.map((f) => JSON.parse(readFileSync(join(housesDir, f), "utf-8")));
  } catch {
    return [];
  }
}
