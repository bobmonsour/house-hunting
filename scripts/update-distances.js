#!/usr/bin/env node
import "dotenv/config";
import { Client } from "@googlemaps/google-maps-services-js";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const DESTINATIONS = [
  { name: "Whole Foods Market", address: "465 S Arroyo Pkwy, Pasadena, CA 91105" },
  { name: "Whole Foods Market", address: "3751 E Foothill Blvd, Pasadena, CA 91107" },
  { name: "Whole Foods Market", address: "331 N Glendale Ave, Glendale, CA 91206" },
  { name: "Trader Joe's", address: "345 S Lake Ave, Pasadena, CA 91101" },
  { name: "Trader Joe's", address: "467 N Rosemead Blvd, Pasadena, CA 91107" },
  { name: "Trader Joe's", address: "613 Mission St, South Pasadena, CA 91030" },
  { name: "Trader Joe's", address: "103 E Glenoaks Blvd, Glendale, CA 91207" },
  { name: "Trader Joe's", address: "2462 Honolulu Ave, Montrose, CA 91020" },
  { name: "Costco", address: "3972 Costco Dr, Arcadia, CA 91006" },
  { name: "Target", address: "777 E Colorado Blvd, Pasadena, CA 91101" },
  { name: "Target", address: "3121 E Colorado Blvd, Pasadena, CA 91107" },
  { name: "Target", address: "2195 Glendale Galleria, Glendale, CA 91210" },
  { name: "Home Depot", address: "2881 E Walnut St, Pasadena, CA 91107" },
  { name: "Home Depot", address: "5040 San Fernando Rd, Glendale, CA 91204" },
  { name: "Republik Coffee", address: "48 W Green St, Pasadena, CA 91105" },
];

const housesDir = join(import.meta.dirname, "../src/_data/houses");

async function getDistances(origin) {
  const maps = new Client({});
  const result = await maps.distancematrix({
    params: {
      origins: [origin],
      destinations: DESTINATIONS.map((d) => d.address),
      mode: "driving",
      key: process.env.GOOGLE_MAPS_API_KEY,
    },
  });

  const elements = result.data.rows[0]?.elements || [];
  const allResults = DESTINATIONS.map((dest, i) => {
    const el = elements[i];
    if (el?.status === "OK") {
      const miles = (el.distance.value / 1609.34).toFixed(1) + " mi";
      const time = el.duration.text.replace("mins", "min");
      return { name: dest.name, address: dest.address, miles, time, meters: el.distance.value };
    }
    return { name: dest.name, address: dest.address, miles: "—", time: "—", meters: Infinity };
  });

  const closest = new Map();
  for (const r of allResults) {
    const existing = closest.get(r.name);
    if (!existing || r.meters < existing.meters) {
      closest.set(r.name, r);
    }
  }
  return [...closest.values()].map(({ name, address, miles, time }) => ({ name, address, miles, time }));
}

const files = readdirSync(housesDir).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const filePath = join(housesDir, file);
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  const origin = `${data.address}, ${data.city}`;
  console.log(`Updating distances for ${data.address}...`);
  const distances = await getDistances(origin);
  data.distances = distances;
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  console.log(`  Done — ${distances.map((d) => `${d.name}: ${d.miles}`).join(", ")}`);
}

console.log("\nAll distances updated.");
