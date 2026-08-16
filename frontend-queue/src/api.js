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
  getMasters: (salonId, onDuty) => {
    const params = new URLSearchParams();
    if (salonId) params.set("salonId", salonId);
    if (onDuty) params.set("onDuty", "true");
    const qs = params.toString();
    return request(qs ? `/api/masters?${qs}` : "/api/masters");
  },
  getServices: () => request("/api/services"),
  createQueueItem: (body) =>
    request("/api/queue", { method: "POST", body: JSON.stringify(body) }),
  getMasterQueue: (masterId) => request(`/api/queue/${masterId}`),
  checkin: (id) => request(`/api/queue/${id}/checkin`, { method: "POST" }),
};

export { API_URL };
