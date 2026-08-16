// Socket.io wrapper с pub/sub и статусом соединения
import { io } from 'socket.io-client';
import { API_URL, HAS_BACKEND } from './api.js';

const listeners = new Set();  // (state) => void  где state = 'connecting' | 'live' | 'offline' | 'error'
const eventListeners = new Map(); // eventName -> Set(fn)

let socket = null;
let currentState = HAS_BACKEND ? 'connecting' : 'offline';

function setState(next) {
  if (currentState === next) return;
  currentState = next;
  listeners.forEach((fn) => { try { fn(next); } catch (e) { console.error(e); } });
}

export function connect() {
  if (!HAS_BACKEND || socket) return;
  socket = io(API_URL, { transports: ['websocket', 'polling'], reconnection: true });
  socket.on('connect',       () => setState('live'));
  socket.on('disconnect',    () => setState('offline'));
  socket.on('connect_error', () => setState('error'));
  socket.on('reconnect_attempt', () => setState('connecting'));

  // Re-attach event listeners on connect (in case connect happens after subscribe)
  for (const [event, handlers] of eventListeners.entries()) {
    handlers.forEach((fn) => socket.on(event, fn));
  }
}

/** Подписаться на state ('connecting'|'live'|'offline'|'error'). Возвращает off() */
export function onState(fn) {
  listeners.add(fn);
  fn(currentState);
  return () => listeners.delete(fn);
}

/** Подписаться на socket-event. Возвращает off() */
export function onEvent(event, fn) {
  if (!eventListeners.has(event)) eventListeners.set(event, new Set());
  eventListeners.get(event).add(fn);
  if (socket) socket.on(event, fn);
  return () => {
    eventListeners.get(event)?.delete(fn);
    if (socket) socket.off(event, fn);
  };
}

export const state = () => currentState;
