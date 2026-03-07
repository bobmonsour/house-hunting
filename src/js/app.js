import { authenticate, hasToken, fetchMutableState } from "./api.js";
import { toggleTheme, restoreTheme } from "./utils.js";
import { renderCards, toggleFav, toggleCompare, toggleFavFilter, setStatusFilter, filterCards, toggleSortDropdown, sortBy } from "./cards.js";
import { openDetail, closeDetail, updateStatus, saveNotes, deleteProperty, galleryPrev, galleryNext, galleryGo, openLightbox, closeLightbox, lightboxPrev, lightboxNext, openMapOverlay, closeMapOverlay, setSidewalks, toggleSidewalksEdit, setStreetTrees, toggleStreetTreesEdit, setCorner, toggleCornerEdit, setRoadNoise, toggleRoadNoiseEdit, setStories, toggleStoriesEdit, setCondition, toggleConditionEdit, toggleWorkItem, setBackyard, toggleBackyardEdit, setStudio, toggleStudioEdit, setTwoSinks, toggleTwoSinksEdit, setWallOvens, toggleWallOvensEdit, setPool, togglePoolEdit } from "./detail.js";
import { openComparison, closeComparison } from "./comparison.js";
import { openMapView, closeMapView } from "./map-view.js";
import { openAddModal, closeAddModal, addProperty } from "./add-property.js";

// Global state shared across modules
export const state = {
  houses: [],
  currentSort: "price",
  currentSortDir: "asc",
  showFavsOnly: false,
  statusFilter: "all",
  compareSet: new Set(),
  currentDetailId: null,
};

// Wire all functions to window for onclick compatibility
window.toggleTheme = toggleTheme;
window.checkPassword = checkPassword;
window.renderCards = renderCards;
window.toggleFav = toggleFav;
window.toggleCompare = toggleCompare;
window.toggleFavFilter = toggleFavFilter;
window.setStatusFilter = setStatusFilter;
window.filterCards = filterCards;
window.toggleSortDropdown = toggleSortDropdown;
window.sortBy = sortBy;
window.openDetail = openDetail;
window.closeDetail = closeDetail;
window.updateStatus = updateStatus;
window.saveNotes = saveNotes;
window.deleteProperty = deleteProperty;
window.galleryPrev = galleryPrev;
window.galleryNext = galleryNext;
window.galleryGo = galleryGo;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.openMapOverlay = openMapOverlay;
window.closeMapOverlay = closeMapOverlay;
window.setSidewalks = setSidewalks;
window.toggleSidewalksEdit = toggleSidewalksEdit;
window.setStreetTrees = setStreetTrees;
window.toggleStreetTreesEdit = toggleStreetTreesEdit;
window.setCorner = setCorner;
window.toggleCornerEdit = toggleCornerEdit;
window.setRoadNoise = setRoadNoise;
window.toggleRoadNoiseEdit = toggleRoadNoiseEdit;
window.setStories = setStories;
window.toggleStoriesEdit = toggleStoriesEdit;
window.setCondition = setCondition;
window.toggleConditionEdit = toggleConditionEdit;
window.toggleWorkItem = toggleWorkItem;
window.setBackyard = setBackyard;
window.toggleBackyardEdit = toggleBackyardEdit;
window.setStudio = setStudio;
window.toggleStudioEdit = toggleStudioEdit;
window.setTwoSinks = setTwoSinks;
window.toggleTwoSinksEdit = toggleTwoSinksEdit;
window.setWallOvens = setWallOvens;
window.toggleWallOvensEdit = toggleWallOvensEdit;
window.setPool = setPool;
window.togglePoolEdit = togglePoolEdit;
window.openComparison = openComparison;
window.closeComparison = closeComparison;
window.openMapView = openMapView;
window.closeMapView = closeMapView;
window.openAddModal = openAddModal;
window.closeAddModal = closeAddModal;
window.addProperty = addProperty;

// Auth flow
async function checkPassword() {
  const pw = document.getElementById("passwordInput").value;
  try {
    await authenticate(pw);
    document.getElementById("passwordScreen").classList.add("hidden");
    await loadHouses();
  } catch {
    document.getElementById("passwordError").classList.add("visible");
    setTimeout(() => document.getElementById("passwordError").classList.remove("visible"), 2000);
  }
}

const MUTABLE_DEFAULTS = {
  notes: "",
  status: "new",
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
};

function mergeHouses(mutableState) {
  const staticHouses = window.__HOUSES__ || [];
  state.houses = staticHouses
    .map((h) => ({
      ...h,
      ...MUTABLE_DEFAULTS,
      ...(mutableState[h.id] || {}),
    }))
    .filter((h) => h.status !== "deleted");
}

async function loadHouses() {
  // Use build-time mutable state for instant render
  const bakedState = window.__MUTABLE_STATE__ || {};
  mergeHouses(bakedState);
  renderCards();

  // Then refresh from live KV in the background
  try {
    const liveState = await fetchMutableState();
    mergeHouses(liveState);
    renderCards();
  } catch (err) {
    console.error("Failed to fetch live mutable state (using build-time data):", err);
  }
}

// Global event listeners
document.addEventListener("click", (e) => {
  if (!e.target.closest(".sort-btn") && !e.target.closest(".sort-dropdown")) {
    document.getElementById("sortDropdown").classList.remove("open");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (document.getElementById("mapViewOverlay").classList.contains("open")) return closeMapView();
    if (document.getElementById("mapOverlay").classList.contains("open")) return closeMapOverlay();
    if (document.getElementById("addModalOverlay").classList.contains("open")) return closeAddModal();
    if (document.getElementById("lightbox").classList.contains("open")) return closeLightbox();
    if (document.getElementById("comparisonOverlay").classList.contains("open")) return closeComparison();
    if (document.getElementById("detailPanel").classList.contains("open")) return closeDetail();
  }
  // Arrow keys for lightbox navigation
  if (document.getElementById("lightbox").classList.contains("open")) {
    if (e.key === "ArrowLeft") return lightboxPrev();
    if (e.key === "ArrowRight") return lightboxNext();
  }
  // Arrow keys for gallery navigation when detail panel is open
  if (document.getElementById("detailPanel").classList.contains("open") && !e.target.closest("textarea, input, select")) {
    if (e.key === "ArrowLeft") return galleryPrev();
    if (e.key === "ArrowRight") return galleryNext();
  }
});

document.getElementById("detailGallery").addEventListener("click", (e) => {
  if (e.target.tagName === "IMG") {
    openLightbox(e.target.src);
  }
});

document.getElementById("addModalOverlay").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeAddModal();
});

// Init
restoreTheme();

if (hasToken()) {
  document.getElementById("passwordScreen").classList.add("hidden");
  loadHouses();
}
