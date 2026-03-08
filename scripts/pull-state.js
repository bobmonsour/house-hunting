#!/usr/bin/env node
import "dotenv/config";
import { writeFileSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const WORKER_URL = process.env.WORKER_URL;
const APP_PASSWORD = process.env.APP_PASSWORD;

// --- Local KV: read state entries from wrangler's SQLite + blob files ---

function getLocalState() {
  const kvDir = join(process.cwd(), ".wrangler", "state", "v3", "kv");
  const sqliteDir = join(kvDir, "miniflare-KVNamespaceObject");

  let dbPath = null;
  try {
    const files = readdirSync(sqliteDir).filter((f) => f.endsWith(".sqlite"));
    for (const f of files) {
      const fullPath = join(sqliteDir, f);
      try {
        const out = execSync(
          `sqlite3 "${fullPath}" "SELECT count(*) FROM _mf_entries WHERE key LIKE 'state:%';"`,
          { encoding: "utf-8" }
        ).trim();
        if (parseInt(out) > 0) {
          dbPath = fullPath;
          break;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }

  if (!dbPath) return null;

  // Collect blob directories
  const blobDirs = [];
  try {
    const kvSubdirs = readdirSync(kvDir).filter((d) => d !== "miniflare-KVNamespaceObject");
    for (const d of kvSubdirs) {
      const blobDir = join(kvDir, d, "blobs");
      try {
        readdirSync(blobDir);
        blobDirs.push(blobDir);
      } catch {
        continue;
      }
    }
  } catch {
    // no blob dirs
  }

  if (blobDirs.length === 0) return null;

  let rows;
  try {
    const raw = execSync(
      `sqlite3 "${dbPath}" "SELECT key, blob_id FROM _mf_entries WHERE key LIKE 'state:%';"`,
      { encoding: "utf-8" }
    ).trim();
    if (!raw) return null;
    rows = raw.split("\n").map((line) => {
      const [key, blob_id] = line.split("|");
      return { key, blob_id };
    });
  } catch {
    return null;
  }

  const stateMap = {};
  for (const { key, blob_id } of rows) {
    const id = key.replace("state:", "");
    for (const blobDir of blobDirs) {
      try {
        const content = readFileSync(join(blobDir, blob_id), "utf-8");
        stateMap[id] = JSON.parse(content);
        break;
      } catch {
        continue;
      }
    }
  }
  return stateMap;
}

// --- Remote API ---

async function getRemoteState() {
  if (!WORKER_URL || !APP_PASSWORD || WORKER_URL.includes("your-subdomain")) {
    return null;
  }
  const res = await fetch(`${WORKER_URL}/api/state`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${APP_PASSWORD}`,
    },
  });
  if (!res.ok) throw new Error(`GET /api/state failed: HTTP ${res.status}`);
  return res.json();
}

// --- Main ---

function seedLocalKV(stateMap) {
  let seeded = 0;
  for (const [id, state] of Object.entries(stateMap)) {
    try {
      const value = JSON.stringify(state);
      execSync(
        `npx wrangler kv key put --binding HOUSES --local --preview "state:${id}" '${value.replace(/'/g, "'\\''")}'`,
        { encoding: "utf-8", stdio: "pipe" }
      );
      seeded++;
    } catch (err) {
      console.warn(`  Failed to seed local KV for state:${id}: ${err.message}`);
    }
  }
  return seeded;
}

async function main() {
  console.log("Pulling mutable state...");

  // Prefer remote state (source of truth for mobile-added properties),
  // fall back to local KV
  let stateMap = null;
  let source = "remote";

  try {
    stateMap = await getRemoteState();
  } catch (err) {
    console.log(`Could not reach remote API: ${err.message}`);
  }

  if (!stateMap || Object.keys(stateMap).length === 0) {
    stateMap = getLocalState();
    source = "local";
  }

  if (!stateMap) stateMap = {};

  const count = Object.keys(stateMap).length;
  const outPath = join(process.cwd(), "src", "_data", "mutableState.json");
  writeFileSync(outPath, JSON.stringify(stateMap, null, 2));

  console.log(`Wrote ${count} property state(s) from ${source} KV to src/_data/mutableState.json`);

  // Seed local wrangler KV so runtime /api/state returns correct data
  if (source === "remote" && count > 0) {
    console.log("Seeding local wrangler KV with remote state...");
    const seeded = seedLocalKV(stateMap);
    console.log(`Seeded ${seeded}/${count} state entries into local KV.`);
  }
}

main().catch((err) => {
  console.error("State pull failed:", err.message);
  // Non-fatal — build continues without pulled state
});
