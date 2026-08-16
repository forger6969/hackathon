import { io } from "socket.io-client";

export const API_URL = import.meta.env.VITE_API_URL;
const STORAGE_KEY = "navbat_master_id";

export const state = {
  currentMaster: null, // full Master object once logged in
  mastersList: [],
  socket: null,
};

const queueListeners = new Set();
const offlineListeners = new Set();

export function onQueueUpdate(fn) {
  queueListeners.add(fn);
  return () => queueListeners.delete(fn);
}

export function onOfflineChange(fn) {
  offlineListeners.add(fn);
  return () => offlineListeners.delete(fn);
}

function setOffline(isOffline) {
  offlineListeners.forEach((fn) => fn(isOffline));
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = new Error(`API xato: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function loadMastersList() {
  state.mastersList = await apiFetch("/api/masters");
  return state.mastersList;
}

export function getRememberedMasterId() {
  return localStorage.getItem(STORAGE_KEY);
}

export function rememberMaster(master) {
  state.currentMaster = master;
  localStorage.setItem(STORAGE_KEY, master._id);
}

export function forgetMaster() {
  state.currentMaster = null;
  localStorage.removeItem(STORAGE_KEY);
}

export async function toggleDuty() {
  const master = state.currentMaster;
  if (!master) return null;
  const nextOnDuty = !master.onDuty;
  const updated = await apiFetch(`/api/masters/${master._id}/duty`, {
    method: "POST",
    body: JSON.stringify({ onDuty: nextOnDuty }),
  });
  state.currentMaster = updated;
  return updated;
}

export function connectSocket() {
  if (state.socket) return state.socket;
  const socket = io(API_URL, { reconnection: true });
  socket.on("connect", () => setOffline(false));
  socket.on("connect_error", () => setOffline(true));
  socket.on("disconnect", () => setOffline(true));
  socket.on("queue:update", (data) => {
    if (!state.currentMaster || data.masterId !== state.currentMaster._id) return;
    queueListeners.forEach((fn) => fn(data.queue));
  });
  state.socket = socket;
  return socket;
}
