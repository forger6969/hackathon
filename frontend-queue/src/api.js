const API_URL = import.meta.env.VITE_API_URL;

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export const api = {
  getSalons: () => request("/api/salons"),
  getMasters: (salonId) => request(salonId ? `/api/masters?salonId=${salonId}` : "/api/masters"),
  getServices: () => request("/api/services"),
  createQueueItem: (body) =>
    request("/api/queue", { method: "POST", body: JSON.stringify(body) }),
  getMasterQueue: (masterId) => request(`/api/queue/${masterId}`),
  checkin: (id) => request(`/api/queue/${id}/checkin`, { method: "POST" }),
  setStatus: (id, status) =>
    request(`/api/queue/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
};

export { API_URL };
