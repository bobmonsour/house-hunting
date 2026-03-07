const API_BASE = "/api";

function getToken() {
  return localStorage.getItem("btp_token") || "";
}

export function setToken(token) {
  localStorage.setItem("btp_token", token);
}

export function clearToken() {
  localStorage.removeItem("btp_token");
}

export function hasToken() {
  return !!localStorage.getItem("btp_token");
}

async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function authenticate(password) {
  const res = await fetch(`${API_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Auth failed");
  setToken(data.token);
  return data;
}

export async function fetchMutableState() {
  return apiFetch("/state");
}

export async function patchState(id, updates) {
  return apiFetch(`/state/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function submitUrl(url) {
  return apiFetch("/addresses", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}
