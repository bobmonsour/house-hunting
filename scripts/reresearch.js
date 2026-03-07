#!/usr/bin/env node
import "dotenv/config";
import { execSync } from "child_process";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const dataDir = join(process.cwd(), "src", "_data", "houses");
const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));

if (files.length === 0) {
  console.log("No property JSON files found.");
  process.exit(0);
}

console.log(`Found ${files.length} properties to re-research.\n`);

let success = 0;
let failed = 0;

for (const file of files) {
  const data = JSON.parse(readFileSync(join(dataDir, file), "utf-8"));
  const { id, address, city, redfinUrl } = data;
  const url = redfinUrl || "";

  console.log(`[${success + failed + 1}/${files.length}] ${address}, ${city}`);
  try {
    execSync(
      `node scripts/research.js "${address}" "${city}" ${id} "${url}"`,
      { stdio: "inherit", cwd: process.cwd() }
    );
    success++;
  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
    failed++;
  }
  console.log();
}

console.log(`Done. ${success} succeeded, ${failed} failed.`);
