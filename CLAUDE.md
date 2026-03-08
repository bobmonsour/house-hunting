# Back to Pasadena — House Hunting App

## Project Overview

A password-protected house hunting web app for comparing properties in the Pasadena, CA area. Built as a static site with a Cloudflare Workers API backend for mutable state (notes, favorites, status).

## Tech Stack

- **Static Site Generator**: Eleventy 3 (ESM, Nunjucks templates)
- **Hosting**: Cloudflare Workers with static assets (`_site/`)
- **Mutable State**: Cloudflare KV (namespace binding: `HOUSES`)
- **Research**: Redfin scraping (JSON-LD + embedded data) + Claude API (Sonnet) for neighborhood info + Google Maps Distance Matrix API
- **Risk Data**: CAL FIRE FHSZ ArcGIS API (fire) + FEMA NFHL ArcGIS API (flood)
- **Geocoding**: Google Maps Geocoding API with US Census geocoder fallback (free, no key)
- **Dependencies**: `@anthropic-ai/sdk`, `@googlemaps/google-maps-services-js`, `dotenv`
- **Fonts**: Playfair Display, Source Sans 3, JetBrains Mono (Google Fonts)
- **Theme**: Light/dark mode, editorial design tone

## Architecture

### Data Flow
1. User adds property via "Add Property" modal (Redfin URL input) → POST `/api/addresses` → worker parses address/city from URL path → saves stub to KV
2. Eleventy `before` event runs `sync-kv.js` (processes stubs from both local + remote KV → runs research per stub → writes JSON + images) then `pull-state.js` (pulls mutable state from remote KV → writes `src/_data/mutableState.json`)
3. Eleventy reads `src/_data/houses.js` (loads all JSON files) → bakes data into `window.__HOUSES__` in `index.njk`
4. At runtime, static data merges with mutable state fetched from `/api/state`

### Research Pipeline (`scripts/research.js`)
1. **Redfin scrape**: Fetch listing page HTML → extract JSON-LD structured data (price, beds, baths, sqft, year built, images, geo coords, date listed) + embedded escaped JSON events array (price history, last sold) + agent info, Redfin estimate
2. **Geocode**: Use Redfin JSON-LD geo coordinates (or Google Maps geocoding, or US Census geocoder fallback)
3. **Fire risk**: Query CAL FIRE FHSZ ArcGIS REST API (SRA layer 0 + LRA layer 1) with lat/lon → "Low" if no zone, else "Moderate"/"High"/"Very High"
4. **Flood risk**: Query FEMA NFHL ArcGIS REST API (layer 28) with lat/lon → interpret FEMA zone codes (X=Low, A/AE=High, V/VE=High coastal)
5. **Claude research**: Web search for neighborhood description, park proximity, crime rating only (not property details)
6. **Google Maps**: Distance matrix to preset destinations
7. **Images**: Download up to 20 listing photos from Redfin JSON-LD image array
8. **Merge all**: Write combined JSON to `src/_data/houses/{id}.json`

### Key Directories
```
src/
  _data/houses.js       — Eleventy data file, reads src/_data/houses/*.json
  _data/houses/         — Per-property JSON files (immutable research data)
  images/{id}/          — Downloaded property photos (up to 20 per listing)
  js/                   — Client-side modules (ES modules, no bundler)
    app.js              — Entry point, auth, state, global event wiring
    api.js              — API client (auth, state CRUD, URL submission)
    add-property.js     — Add property modal logic (Redfin URL input)
    cards.js            — Card grid rendering, sorting, filtering
    detail.js           — Full-page detail view, gallery/lightbox, inline-editable fields
    comparison.js       — Side-by-side comparison view (2-3 properties)
    utils.js            — formatPrice, getDaysOnMarket, theme toggle
  css/styles.css        — All styles (CSS custom properties, light/dark themes)
  index.njk             — Single-page app template
worker/index.js         — Cloudflare Worker (auth, KV state, Redfin URL stubs)
scripts/
  research.js           — Redfin scraping + Claude neighborhood research + risk APIs + distances
  sync-kv.js            — Prebuild: process KV stubs → run research → write data files
  migrate-kv.js         — One-time migration from old KV format
```

### Property Data Model (JSON in `src/_data/houses/{id}.json`)
```json
{
  "id": 1772771370317,
  "address": "1247 Meridian Ave",
  "city": "South Pasadena, CA 91030",
  "price": 1200000,
  "beds": 3,
  "baths": 2,
  "sqft": 1500,
  "yearBuilt": 1925,
  "images": ["/images/{id}/photo-1.jpg", "/images/{id}/photo-2.jpg"],
  "neighborhood": "...",
  "parkProximity": "0.3 miles to Garfield Park",
  "floodRisk": "Low — Zone X, minimal flood hazard (FEMA NFHL)",
  "fireRisk": "Low — not in a fire hazard severity zone (CAL FIRE FHSZ)",
  "crimeRating": "Very Low — Grade A (CrimeGrade.org)",
  "distances": [{ "name": "Whole Foods Market", "miles": "2.1 mi", "time": "7 min" }],
  "agent": { "name": "...", "phone": "...", "email": "..." },
  "dateListed": "2026-01-15",
  "priceHistory": [{ "type": "listed", "label": "Listed", "date": "Jan 15, 2026", "amount": 1200000 }],
  "lastSold": { "date": "Sep 8, 2023", "price": 900000 },
  "estimates": { "redfin": 1150000 },
  "listingUrl": "https://www.redfin.com/...",
  "listingSource": "redfin",
  "redfinUrl": "https://www.redfin.com/..."
}
```

### Mutable State (KV `state:{id}`)
```json
{ "notes": "", "status": "new", "favorite": false, "sidewalks": null, "streetTrees": null, "corner": null, "roadNoise": null, "stories": null, "condition": null, "backyard": null, "studio": null, "twoSinks": null, "wallOvens": null, "pool": null, "walkInShower": null, "characterHome": null, "garage": null }
```

### KV Stub Format (KV `stub:{id}`)
```json
{ "id": 1772814416071, "url": "https://www.redfin.com/CA/Pasadena/...", "address": "1234 Oak St", "city": "Pasadena, CA 91101", "createdAt": "2026-03-06T..." }
```

## Commands

- `npm run build` — Build static site (runs sync-kv.js as prebuild)
- `npm run dev` — Build + start Wrangler dev server
- `npm run deploy` — Build + deploy to Cloudflare Workers
- `npm run research` — Manual research: `node scripts/research.js "<address>" "<city>" <id> "<redfinUrl>"`
- `npm run sync` — Process pending address stubs from KV

## Key Patterns

- **No bundler**: Client JS uses native ES modules with `import`/`export`
- **Window bindings**: All functions exposed via `window.functionName` in `app.js` for `onclick` handlers
- **IDs are timestamps**: `Date.now()` used as property IDs
- **Hash routing**: Detail view opens at `#property/{id}`, enabling browser back/forward navigation between grid and detail views. `popstate` listener in `app.js` handles navigation. Direct URLs work after auth.
- **Full-page detail view**: Detail view is a full-page layout (not a slide-in panel), toggling `#detailPage` / `#cardGrid` visibility. Uses native document scrolling (fixes iOS scroll issues). Sticky topbar with back button and status selector.
- **Deferred card re-render**: Status/note changes on the detail page set `state.cardsDirty = true` instead of immediately re-rendering. Grid re-renders only when closing the detail view via `closeDetail()`.
- **Rejected properties**: Cards with status "Rejected" are separated into a distinct section below active cards with reduced opacity and a darker background. Rejected card images show a diagonal red strikethrough. "Rejected" is excluded from the status filter dropdown.
- **Risk display**: `riskClass()` in `detail.js` maps risk strings to CSS classes (`risk-low`, `risk-medium`, `risk-high`) based on prefix matching
- **Inline-editable fields**: Sidewalks, street trees, corner lot, road noise, stories, condition, backyard, studio, two sinks, wall ovens, pool, walk-in shower, character home, garage — toggle between display/edit mode, persist to KV. Gallery position preserved during inline edits.
- **Auth**: Simple shared password, token stored in localStorage as `btp_token`
- **Redfin URL parsing**: Worker extracts address/city from URL path pattern `/CA/City-Name/123-Street-Name-91030/home/12345`
- **Image gallery**: Detail view shows prev/next nav + counter for multi-image listings (dots shown for ≤10 images). Arrow key navigation in both gallery and lightbox. Touch swipe support for gallery and lightbox.
- **Native fetch()**: research.js uses Node's built-in `fetch()` instead of `https.get` to avoid interference from the Anthropic SDK's HTTP stack

## External APIs (no keys required)

- **CAL FIRE FHSZ**: `https://services.gis.ca.gov/arcgis/rest/services/Environment/Fire_Severity_Zones/MapServer` (layers 0=SRA, 1=LRA)
- **FEMA NFHL**: `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28`
- **US Census Geocoder**: `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress` (fallback when no Google Maps key)

## Destinations for Distance Calculations
Multiple locations per store across Pasadena, South Pasadena, Glendale, Montrose, and Arcadia. The research script calculates driving distance to all locations and keeps only the closest per store name. Stores: Whole Foods Market, Trader Joe's, Costco, Target, Home Depot, Republik Coffee.

## Environment Variables (`.env`)
- `ANTHROPIC_API_KEY` — For Claude research
- `GOOGLE_MAPS_API_KEY` — For distance matrix and geocoding (optional — Census geocoder used as fallback)
- `WORKER_URL` — Production worker URL (for remote stub sync)
- `APP_PASSWORD` — Shared app password
