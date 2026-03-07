#!/usr/bin/env node
import "dotenv/config";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * One-time migration: splits existing house:* KV entries into:
 *   - src/_data/houses/{id}.json  (immutable research data)
 *   - state:{id} KV keys          (mutable user state)
 *
 * Also works from the seed data in seed/seed-kv.js as a fallback
 * by reading keys from local KV via wrangler.
 */

const MUTABLE_FIELDS = ["notes", "status", "favorite", "sidewalks", "streetTrees"];

// Determine env
const isProduction = process.argv.includes("--production");
const bindingFlag = isProduction ? "--preview false" : "--local --preview";

console.log(`Migrating from ${isProduction ? "PRODUCTION" : "LOCAL"} KV...\n`);

// List all house:* keys
let keyList;
try {
  const raw = execSync(
    `npx wrangler kv key list --binding HOUSES ${bindingFlag}`,
    { encoding: "utf-8", cwd: process.cwd() }
  );
  keyList = JSON.parse(raw);
} catch (err) {
  console.error("Failed to list KV keys. Make sure you've seeded local KV first.");
  console.error("Run: npm run seed");
  process.exit(1);
}

const houseKeys = keyList.filter((k) => k.name.startsWith("house:"));
console.log(`Found ${houseKeys.length} house entries.\n`);

const dataDir = join(process.cwd(), "src", "_data", "houses");
mkdirSync(dataDir, { recursive: true });

for (const key of houseKeys) {
  let house;
  try {
    const raw = execSync(
      `npx wrangler kv key get --binding HOUSES ${bindingFlag} "${key.name}"`,
      { encoding: "utf-8", cwd: process.cwd() }
    );
    house = JSON.parse(raw);
  } catch (err) {
    console.error(`  Failed to read ${key.name}:`, err.message);
    continue;
  }

  const id = house.id;

  // Extract mutable state
  const mutableState = {};
  for (const field of MUTABLE_FIELDS) {
    if (field in house) {
      mutableState[field] = house[field];
    }
  }
  // Set defaults for missing mutable fields
  mutableState.notes = mutableState.notes ?? "";
  mutableState.status = mutableState.status ?? "new";
  mutableState.favorite = mutableState.favorite ?? false;
  mutableState.sidewalks = mutableState.sidewalks ?? null;
  mutableState.streetTrees = mutableState.streetTrees ?? null;

  // Write state:{id} to KV
  const stateKey = `state:${id}`;
  const stateJson = JSON.stringify(mutableState);
  try {
    execSync(
      `npx wrangler kv key put --binding HOUSES ${bindingFlag} "${stateKey}" '${stateJson.replace(/'/g, "'\\''")}'`,
      { stdio: "inherit", cwd: process.cwd() }
    );
    console.log(`  KV: ${stateKey} written`);
  } catch (err) {
    console.error(`  Failed to write ${stateKey}:`, err.message);
  }

  // Extract immutable data (everything except mutable fields)
  const immutable = { ...house };
  for (const field of MUTABLE_FIELDS) {
    delete immutable[field];
  }

  // Write src/_data/houses/{id}.json
  const outPath = join(dataDir, `${id}.json`);
  writeFileSync(outPath, JSON.stringify(immutable, null, 2));
  console.log(`  File: ${outPath}`);
  console.log(`  Done: ${house.address}\n`);
}

console.log("Migration complete!");
console.log("\nNext steps:");
console.log("  1. Run: npm run build");
console.log("  2. Run: wrangler deploy");
