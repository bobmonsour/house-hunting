export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (!path.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });

    // POST /api/auth — unauthenticated
    if (path === "/api/auth" && request.method === "POST") {
      const body = await request.json();
      if (body.password === env.APP_PASSWORD) {
        return json({ ok: true, token: env.APP_PASSWORD });
      }
      return json({ ok: false, error: "Invalid password" }, 401);
    }

    // All other routes require auth
    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (token !== env.APP_PASSWORD) {
      return json({ error: "Unauthorized" }, 401);
    }

    // GET /api/state — return all mutable state as { [id]: { notes, status, ... } }
    if (path === "/api/state" && request.method === "GET") {
      const list = await env.HOUSES.list({ prefix: "state:" });
      const stateMap = {};
      for (const key of list.keys) {
        const id = key.name.replace("state:", "");
        const val = await env.HOUSES.get(key.name, "json");
        if (val) stateMap[id] = val;
      }
      return json(stateMap);
    }

    // PATCH /api/state/:id — update mutable fields
    const stateMatch = path.match(/^\/api\/state\/(\w+)$/);
    if (stateMatch && request.method === "PATCH") {
      const id = stateMatch[1];
      const key = `state:${id}`;
      const allowed = ["notes", "visited", "offer", "rejected", "deleted", "favorite", "sidewalks", "streetTrees", "corner", "roadNoise", "stories", "condition", "workNeeded", "backyard", "studio", "twoSinks", "wallOvens", "pool", "walkInShower", "characterHome", "garage"];

      const existing = (await env.HOUSES.get(key, "json")) || {
        notes: "",
        visited: false,
        offer: false,
        rejected: false,
        favorite: false,
        sidewalks: null,
        streetTrees: null,
        corner: null,
        roadNoise: null,
        stories: null,
        condition: null,
        workNeeded: [],
        backyard: null,
        studio: null,
        twoSinks: null,
        wallOvens: null,
        pool: null,
        walkInShower: null,
        characterHome: null,
        garage: null,
      };

      const updates = await request.json();
      const filtered = {};
      for (const [k, v] of Object.entries(updates)) {
        if (allowed.includes(k)) filtered[k] = v;
      }

      const merged = { ...existing, ...filtered };
      await env.HOUSES.put(key, JSON.stringify(merged));
      return json(merged);
    }

    // POST /api/addresses — save property stub from Redfin URL
    if (path === "/api/addresses" && request.method === "POST") {
      const body = await request.json();
      if (!body.url) return json({ error: "url required" }, 400);

      // Parse address/city from Redfin URL path
      // Pattern: /CA/South-Pasadena/1247-Meridian-Ave-91030/home/12345
      const urlMatch = body.url.match(/redfin\.com\/([A-Z]{2})\/([^/]+)\/([^/]+)\/home\/(\d+)/);
      if (!urlMatch) return json({ error: "Invalid Redfin URL" }, 400);

      // Check for duplicate Redfin URL in existing stubs
      const existingStubs = await env.HOUSES.list({ prefix: "stub:" });
      for (const key of existingStubs.keys) {
        const existing = await env.HOUSES.get(key.name, "json");
        if (existing && existing.url === body.url) {
          return json({ error: "Property already added", existing }, 409);
        }
      }

      const [, state, rawCity, rawStreet] = urlMatch;
      const cityName = rawCity.replace(/-/g, " ");
      // Street: last segment is zip code, rest is the address
      const streetParts = rawStreet.split("-");
      const zip = streetParts[streetParts.length - 1];
      const streetAddress = streetParts.slice(0, -1).join(" ");
      const city = `${cityName}, ${state} ${zip}`;

      const id = body.id || Date.now();
      const stub = {
        id,
        url: body.url,
        address: streetAddress,
        city,
        createdAt: new Date().toISOString(),
      };

      await env.HOUSES.put(`stub:${id}`, JSON.stringify(stub));

      // Also init mutable state with defaults
      await env.HOUSES.put(
        `state:${id}`,
        JSON.stringify({
          notes: "",
          visited: false,
          offer: false,
          rejected: false,
          favorite: false,
          sidewalks: null,
          streetTrees: null,
          corner: null,
          roadNoise: null,
          stories: null,
        condition: null,
        workNeeded: [],
        backyard: null,
        studio: null,
        twoSinks: null,
        wallOvens: null,
        pool: null,
        })
      );

      return json(stub, 201);
    }

    // GET /api/addresses — list all stubs for build-time sync
    if (path === "/api/addresses" && request.method === "GET") {
      const list = await env.HOUSES.list({ prefix: "stub:" });
      const stubs = [];
      for (const key of list.keys) {
        const val = await env.HOUSES.get(key.name, "json");
        if (val) stubs.push(val);
      }
      return json(stubs);
    }

    // DELETE /api/addresses/:id — remove stub after research
    const addrMatch = path.match(/^\/api\/addresses\/(\w+)$/);
    if (addrMatch && request.method === "DELETE") {
      const id = addrMatch[1];
      await env.HOUSES.delete(`stub:${id}`);
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  },
};
