export const mockMasters = [
  { _id: "mock-aziz", name: "Aziz", avgServiceTimeMs: 20 * 60 * 1000, active: true },
  { _id: "mock-sardor", name: "Sardor", avgServiceTimeMs: 25 * 60 * 1000, active: true },
];

export const mockServices = [
  { _id: "mock-haircut", name: "Soch olish", price: 30000 },
  { _id: "mock-beard", name: "Soqol olish", price: 20000 },
  { _id: "mock-combo", name: "Soch + soqol", price: 45000 },
  { _id: "mock-kids", name: "Bolalar", price: 20000 },
];

export function mockCreateQueueItem(body) {
  return {
    _id: "mock-" + Date.now(),
    ...body,
    status: "waiting",
    position: 2,
    eta: 35 * 60 * 1000,
  };
}

export function mockQueueList(masterId, myId) {
  return [
    { _id: "mock-other-1", clientName: "Boshqa mijoz", status: "in_progress", eta: 0 },
    { _id: myId, clientName: "Siz", status: "waiting", eta: 20 * 60 * 1000 },
  ];
}
