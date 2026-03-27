#!/usr/bin/env node
import "dotenv/config";
import { Client } from "@googlemaps/google-maps-services-js";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const housesDir = join(process.cwd(), "src", "_data", "houses");
const kmlPath = join(process.cwd(), "src", "_data", "peep-map.kml");

// Parse peep locations from KML
function parsePeepKml() {
  const kml = readFileSync(kmlPath, "utf-8");
  const placemarks = [];
  const re = /<Placemark>[\s\S]*?<name>(?:<!\[CDATA\[([^\]]*)\]\]>|([^<]+))<\/name>[\s\S]*?<coordinates>\s*([\d.,-]+)\s*<\/coordinates>[\s\S]*?<\/Placemark>/g;
  let m;
  while ((m = re.exec(kml))) {
    const name = (m[1] || m[2]).trim();
    const [lon, lat] = m[3].split(",").map(Number);
    placemarks.push({ name, lat, lon });
  }
  return placemarks;
}

async function main() {
  if (!process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY === "your-key-here") {
    console.error("GOOGLE_MAPS_API_KEY required.");
    process.exit(1);
  }

  const peeps = parsePeepKml();
  console.log(`Found ${peeps.length} peep locations in KML.`);

  const files = readdirSync(housesDir).filter((f) => f.endsWith(".json"));
  console.log(`Processing ${files.length} properties...\n`);

  const maps = new Client({});

  for (const file of files) {
    const filePath = join(housesDir, file);
    const house = JSON.parse(readFileSync(filePath, "utf-8"));
    const origin = `${house.address}, ${house.city}`;

    console.log(`${house.address}...`);

    try {
      const destinations = peeps.map((p) => `${p.lat},${p.lon}`);

      // Fetch driving and walking distances in parallel
      const [drivingResult, walkingResult] = await Promise.all([
        maps.distancematrix({
          params: { origins: [origin], destinations, mode: "driving", key: process.env.GOOGLE_MAPS_API_KEY },
        }),
        maps.distancematrix({
          params: { origins: [origin], destinations, mode: "walking", key: process.env.GOOGLE_MAPS_API_KEY },
        }),
      ]);

      const drivingEls = drivingResult.data.rows[0]?.elements || [];
      const walkingEls = walkingResult.data.rows[0]?.elements || [];
      const distances = [];
      let totalMeters = 0;
      let totalSeconds = 0;
      let count = 0;

      for (let i = 0; i < peeps.length; i++) {
        const dEl = drivingEls[i];
        const wEl = walkingEls[i];
        const entry = { name: peeps[i].name, lat: peeps[i].lat, lon: peeps[i].lon };

        if (dEl?.status === "OK") {
          entry.driving = {
            miles: (dEl.distance.value / 1609.34).toFixed(1) + " mi",
            time: dEl.duration.text.replace("mins", "min"),
          };
          totalMeters += dEl.distance.value;
          totalSeconds += dEl.duration.value;
          count++;
        } else {
          entry.driving = { miles: "—", time: "—" };
        }

        if (wEl?.status === "OK") {
          entry.walking = {
            miles: (wEl.distance.value / 1609.34).toFixed(1) + " mi",
            time: wEl.duration.text.replace("mins", "min"),
          };
        } else {
          entry.walking = { miles: "—", time: "—" };
        }

        distances.push(entry);
      }

      if (count > 0) {
        const avgMiles = (totalMeters / count / 1609.34).toFixed(1) + " mi";
        const avgMin = Math.round(totalSeconds / count / 60) + " min";
        house.peepRating = { avgMiles, avgTime: avgMin, distances };
        console.log(`  → ${avgMiles} / ${avgMin} avg`);
      } else {
        house.peepRating = null;
        console.log("  → no results");
      }
    } catch (err) {
      console.error(`  → error: ${err.message}`);
      house.peepRating = null;
    }

    writeFileSync(filePath, JSON.stringify(house, null, 2));
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
