#!/usr/bin/env node
import "dotenv/config";
import { execSync } from "child_process";
import { readFileSync, readdirSync, unlinkSync, existsSync, rmSync } from "fs";
import { join } from "path";

const WORKER_URL = process.env.WORKER_URL;
const APP_PASSWORD = process.env.APP_PASSWORD;

// --- Local KV: read stubs directly from wrangler's SQLite + blob files ---

function findLocalKV() {
  const kvDir = join(process.cwd(), ".wrangler", "state", "v3", "kv");
  const sqliteDir = join(kvDir, "miniflare-KVNamespaceObject");

  // Find the SQLite DB that contains stub: keys
  let dbPath = null;
  let blobBaseDir = null;
  try {
    const files = readdirSync(sqliteDir).filter((f) => f.endsWith(".sqlite"));
    for (const f of files) {
      const fullPath = join(sqliteDir, f);
      try {
        const out = execSync(
          `sqlite3 "${fullPath}" "SELECT count(*) FROM _mf_entries WHERE key LIKE 'stub:%';"`,
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

  // Collect all blob directories (production + preview KV namespaces)
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
    // no blob dirs found
  }

  return { dbPath, blobDirs };
}

function getLocalStubs() {
  const kv = findLocalKV();
  if (!kv) return [];

  const { dbPath, blobDirs } = kv;
  if (blobDirs.length === 0) return [];

  let rows;
  try {
    const raw = execSync(
      `sqlite3 "${dbPath}" "SELECT key, blob_id FROM _mf_entries WHERE key LIKE 'stub:%';"`,
      { encoding: "utf-8" }
    ).trim();
    if (!raw) return [];
    rows = raw.split("\n").map((line) => {
      const [key, blob_id] = line.split("|");
      return { key, blob_id };
    });
  } catch {
    return [];
  }

  const stubs = [];
  for (const { key, blob_id } of rows) {
    let found = false;
    for (const blobDir of blobDirs) {
      try {
        const blobPath = join(blobDir, blob_id);
        const content = readFileSync(blobPath, "utf-8");
        stubs.push(JSON.parse(content));
        found = true;
        break;
      } catch {
        continue;
      }
    }
    if (!found) {
      console.warn(`  Could not read blob for ${key}`);
    }
  }
  return stubs;
}

function deleteLocalStub(id) {
  const kv = findLocalKV();
  if (!kv) return;

  try {
    execSync(
      `sqlite3 "${kv.dbPath}" "DELETE FROM _mf_entries WHERE key = 'stub:${id}';"`,
      { encoding: "utf-8" }
    );
  } catch {
    // non-fatal
  }
}

// --- Remote API: for production stubs added from mobile ---

async function apiFetch(path, options = {}) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${APP_PASSWORD}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${path}: HTTP ${res.status}`);
  return res.json();
}

async function getRemoteStubs() {
  return apiFetch("/api/addresses");
}

async function deleteRemoteStub(id) {
  return apiFetch(`/api/addresses/${id}`, { method: "DELETE" });
}

// --- Clean up deleted properties ---

function cleanDeletedProperties() {
  const kv = findLocalKV();
  if (!kv) return;

  let rows;
  try {
    const raw = execSync(
      `sqlite3 "${kv.dbPath}" "SELECT key, blob_id FROM _mf_entries WHERE key LIKE 'state:%';"`,
      { encoding: "utf-8" }
    ).trim();
    if (!raw) return;
    rows = raw.split("\n").map((line) => {
      const [key, blob_id] = line.split("|");
      return { key, blob_id };
    });
  } catch {
    return;
  }

  const dataDir = join(process.cwd(), "src", "_data", "houses");
  const imagesDir = join(process.cwd(), "src", "images");

  for (const { key, blob_id } of rows) {
    let stateData = null;
    for (const blobDir of kv.blobDirs) {
      try {
        stateData = JSON.parse(readFileSync(join(blobDir, blob_id), "utf-8"));
        break;
      } catch {
        continue;
      }
    }

    if (stateData && stateData.status === "deleted") {
      const id = key.replace("state:", "");
      const jsonPath = join(dataDir, `${id}.json`);
      const imgPath = join(imagesDir, id);

      if (existsSync(jsonPath)) {
        unlinkSync(jsonPath);
        console.log(`  Removed deleted property data: ${id}.json`);
      }
      if (existsSync(imgPath)) {
        rmSync(imgPath, { recursive: true });
        console.log(`  Removed deleted property images: ${id}/`);
      }
    }
  }
}

// --- Main ---

async function main() {
  console.log("Cleaning up deleted properties...");
  cleanDeletedProperties();

  console.log("Checking for new address stubs...");

  let stubs = [];
  let useRemote = false;

  // Try local KV first
  stubs = getLocalStubs();

  // Fall back to remote API if no local stubs found
  if (stubs.length === 0 && WORKER_URL && APP_PASSWORD && !WORKER_URL.includes("your-subdomain")) {
    try {
      stubs = await getRemoteStubs();
      useRemote = true;
    } catch (err) {
      console.log(`Could not reach remote API: ${err.message}`);
    }
  }

  if (!stubs || stubs.length === 0) {
    console.log("No new addresses. Nothing to do.");
    return;
  }

  console.log(`Found ${stubs.length} new address stub(s) in ${useRemote ? "remote" : "local"} KV.`);

  for (const stub of stubs) {
    console.log(`\nResearching: ${stub.address}, ${stub.city} (id: ${stub.id})`);
    try {
      const urlArg = stub.url ? `"${stub.url}"` : '""';
      execSync(
        `node scripts/research.js "${stub.address}" "${stub.city}" ${stub.id} ${urlArg}`,
        { stdio: "inherit", cwd: process.cwd() }
      );

      if (useRemote) {
        await deleteRemoteStub(stub.id);
      } else {
        deleteLocalStub(stub.id);
      }
      console.log(`  Stub deleted for id ${stub.id}`);
    } catch (err) {
      console.error(`  Failed to process stub ${stub.id}:`, err.message);
    }
  }

  console.log("\nSync complete.");
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
