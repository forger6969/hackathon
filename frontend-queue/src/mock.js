export const mockSalons = [
  { _id: "mock-salon-1", name: "Navbat — Chilonzor", address: "Chilonzor tumani, Bunyodkor shoh ko'chasi 12" },
  { _id: "mock-salon-2", name: "Navbat — Yunusobod", address: "Yunusobod tumani, Amir Temur ko'chasi 45" },
];

export const mockMasters = [
  { _id: "mock-aziz", name: "Aziz", photoUrl: "", avgServiceTimeMs: 20 * 60 * 1000, active: true },
  { _id: "mock-sardor", name: "Sardor", photoUrl: "", avgServiceTimeMs: 25 * 60 * 1000, active: true },
];

export const mockServices = [
  { _id: "mock-haircut", name: "Soch olish", price: 30000 },
  { _id: "mock-beard", name: "Soqol olish", price: 20000 },
  { _id: "mock-combo", name: "Soch + soqol", price: 45000 },
  { _id: "mock-color", name: "Bo'yash", price: 60000 },
];

export function mockCreateQueueItem(body) {
  const scheduled = !!body.scheduledFor;
  return {
    _id: "mock-" + Date.now(),
    ...body,
    status: scheduled ? "scheduled" : "waiting",
    position: 2,
    eta: scheduled ? null : 35 * 60 * 1000,
  };
}

export function mockQueueList(masterId, myId) {
  return [
    { _id: "mock-other-1", clientName: "Boshqa mijoz", status: "in_progress", eta: 0 },
    { _id: myId, clientName: "Siz", status: "waiting", eta: 20 * 60 * 1000 },
  ];
}

export function mockCheckin(item) {
  return { ...item, status: "waiting", eta: 20 * 60 * 1000, position: 2 };
}
