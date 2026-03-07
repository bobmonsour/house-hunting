import { state } from "./app.js";
import { formatPrice } from "./utils.js";

let map = null;
let markers = [];

const STATUS_COLORS = {
  new: "#7B6DAA",
  interested: "#2D5A3D",
  visited: "#4A6FA5",
  offer: "#C4703E",
  rejected: "#A85454",
};

const PASADENA_CENTER = { lat: 34.1478, lng: -118.1445 };

function loadMapsAPI() {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.marker?.AdvancedMarkerElement) {
      return resolve();
    }
    const key = window.__MAPS_KEY__;
    if (!key) return reject(new Error("No Google Maps API key"));
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=marker&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Maps JS API"));
    document.head.appendChild(script);
  });
}

function createPinElement(house) {
  const status = house.status || "new";
  const color = STATUS_COLORS[status] || STATUS_COLORS.new;

  const pin = document.createElement("div");
  pin.className = "map-marker-pin";
  pin.style.cssText = `
    width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
    background: ${color}; transform: rotate(-45deg);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white;
    cursor: pointer; position: relative;
  `;

  // Inner glyph
  const glyph = document.createElement("span");
  glyph.style.cssText = `transform: rotate(45deg); font-size: 14px; line-height: 1;`;

  if (status === "rejected") {
    glyph.textContent = "\u2717";
    glyph.style.color = "white";
    glyph.style.fontWeight = "bold";
  } else if (house.favorite) {
    glyph.textContent = "\u2665";
    glyph.style.color = "white";
  } else {
    glyph.textContent = "";
  }

  pin.appendChild(glyph);
  return pin;
}

function createInfoContent(house) {
  const price = house.price ? formatPrice(house.price) : "—";
  const img = house.images?.[0] || "";
  return `
    <div style="font-family: 'Source Sans 3', sans-serif; max-width: 240px; cursor: pointer;" onclick="openDetail(${house.id})">
      ${img ? `<img src="${img}" style="width:100%; height:120px; object-fit:cover; border-radius:8px 8px 0 0; display:block;">` : ""}
      <div style="padding:10px 12px;">
        <div style="font-weight:700; font-size:1.05rem;">${price}</div>
        <div style="font-size:0.85rem; color:#6B6960; margin-top:2px;">${house.address}</div>
        <div style="font-size:0.82rem; color:#9C978C;">${house.beds}bd / ${house.baths}ba / ${house.sqft?.toLocaleString() || "—"} sqft</div>
      </div>
    </div>
  `;
}

async function geocodeAddress(address, city) {
  const geocoder = new google.maps.Geocoder();
  try {
    const result = await geocoder.geocode({ address: `${address}, ${city}` });
    if (result.results?.[0]) {
      const loc = result.results[0].geometry.location;
      return { lat: loc.lat(), lng: loc.lng() };
    }
  } catch (e) {
    console.warn("Geocode failed for", address, e);
  }
  return null;
}

function clearMarkers() {
  markers.forEach((m) => (m.map = null));
  markers = [];
}

let openInfoWindow = null;

async function placeMarkers() {
  clearMarkers();
  const bounds = new google.maps.LatLngBounds();
  let hasMarkers = false;

  for (const house of state.houses) {
    let position;
    if (house.lat && house.lon) {
      position = { lat: house.lat, lng: house.lon };
    } else {
      position = await geocodeAddress(house.address, house.city);
      if (!position) continue;
    }

    const pinEl = createPinElement(house);
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      content: pinEl,
      title: `${house.address} — ${formatPrice(house.price)}`,
    });

    const infoWindow = new google.maps.InfoWindow({
      content: createInfoContent(house),
    });

    marker.addListener("click", () => {
      if (openInfoWindow) openInfoWindow.close();
      infoWindow.open({ anchor: marker, map });
      openInfoWindow = infoWindow;
    });

    markers.push(marker);
    bounds.extend(position);
    hasMarkers = true;
  }

  if (hasMarkers) {
    map.fitBounds(bounds, 60);
  }
}

export async function openMapView() {
  const overlay = document.getElementById("mapViewOverlay");
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  try {
    await loadMapsAPI();
  } catch (e) {
    alert("Could not load Google Maps. Enable Maps JavaScript API in your Google Cloud Console.");
    closeMapView();
    return;
  }

  if (!map) {
    map = new google.maps.Map(document.getElementById("mapViewCanvas"), {
      center: PASADENA_CENTER,
      zoom: 13,
      mapId: "house-hunting-map",
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
  }

  await placeMarkers();
}

export function closeMapView() {
  const overlay = document.getElementById("mapViewOverlay");
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  if (openInfoWindow) {
    openInfoWindow.close();
    openInfoWindow = null;
  }
}
