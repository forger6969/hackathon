// Минималистичный reactive store с pub/sub
export function createStore(initial = {}) {
  let state = { ...initial };
  const subs = new Set();

  function get() { return state; }

  function set(patch) {
    const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
    if (Object.is(next, state)) return;
    state = next;
    subs.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
  }

  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

  return { get, set, subscribe };
}

// Глобальный store приложения
export const app = createStore({
  salons: [],
  masters: [],
  services: [],
  stock: [],
  today: null,           // { clientsServed, revenue, lowStock, activeMasters }
  queue: [],             // все active из /api/queue
  currentSalonId: null,  // фильтр глобальный (null = все)
  connState: 'connecting',
  ready: false,
});
