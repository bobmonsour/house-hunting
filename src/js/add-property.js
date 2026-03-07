import { submitUrl } from "./api.js";

export function openAddModal() {
  document.getElementById("addModalOverlay").classList.add("open");
  document.getElementById("addUrlInput").value = "";
  setTimeout(() => document.getElementById("addUrlInput").focus(), 100);
}

export function closeAddModal() {
  document.getElementById("addModalOverlay").classList.remove("open");
}

export async function addProperty() {
  const url = document.getElementById("addUrlInput").value.trim();
  if (!url) return;

  if (!url.includes("redfin.com/")) {
    alert("Please enter a valid Redfin listing URL.");
    return;
  }

  closeAddModal();

  try {
    await submitUrl(url);
    alert("Property saved! It will appear with full details after the next build.");
  } catch (err) {
    console.error("Failed to submit URL:", err);
    alert("Failed to save property. Please try again.");
  }
}
