# Навбат — CRM для махаллинской сартарошхоны (хакатон MARS IT)

Живая очередь для парикмахерской без календаря/бронирования. Клиент сканирует QR
на зеркале в салоне и без регистрации видит свою позицию в очереди и ETA. Хозяин,
мастер и клиент — три отдельных фронтенда поверх одного бэкенда.

## Команда и зоны ответственности

- **Saidazim** — бэкенд (`/backend`): Express + MongoDB (Mongoose) + Socket.io +
  Cloudinary, деплой на Render.
- **@sxvsq** — единый UI-кит (цвета/шрифт/кнопки/отступы) для всех трёх фронтендов,
  отдаётся остальным до начала вёрстки.
- **Frontend Owner** (`/frontend-owner`) — экран хозяина "Сегодня": выручка,
  сколько клиентов обслужено, остатки склада.
- **Frontend Master** (`/frontend-master`) — экран мастера: живая очередь, три
  кнопки статуса (Принял → Готово / Не пришёл).
- **Frontend Queue** (`/frontend-queue`) — клиентский экран по QR, без логина:
  номер в очереди, ETA, кнопка "отойду на 15 минут".

## Стек

Монолит, один Express-процесс отдаёт API + Socket.io + (в проде) статику всех
трёх фронтендов. MongoDB Atlas (бесплатный M0). Деплой — один Render Web Service.
Локально каждый фронтендер поднимает `/backend` у себя, чтобы не зависеть от чужого
ноутбука.

Фронтенды — Vite + vanilla JS (без фреймворка, нет времени на архитектуру),
`socket.io-client`. Адрес бэка берётся из `.env` (`VITE_API_URL`), чтобы одной
строкой переключаться между локальной разработкой и продом на Render.

## Структура репозитория

```
/backend
  server.js          — точка входа, Express + Socket.io + Mongoose
  /config            — db.js (mongoose.connect), cloudinary.js
  /models            — Master, Service, Stock, QueueItem
  /routes            — queue.js, owner.js, catalog.js
  seed.js            — тестовые данные (2 мастера, 4 услуги, 4 позиции склада)
  .env.example       — шаблон переменных окружения
/frontend-owner       — Vite vanilla, экран хозяина
/frontend-master      — Vite vanilla, экран мастера
/frontend-queue       — Vite vanilla, экран клиента
```

## API-контракт

```
GET  /health                    → { ok: true }

GET  /api/masters                → [{ _id, name, avgServiceTimeMs, active }]
GET  /api/services                → [{ _id, name, price, stockUse }]
GET  /api/stock                   → [{ _id, name, qty, unit, lowThreshold }]

POST /api/queue
  body: { clientName, phone, serviceId, masterId }
  → создаёт запись в очереди со статусом "waiting"

GET  /api/queue/:masterId
  → [{ _id, clientName, status, eta }]  — живая очередь мастера, отсортирована по времени создания

POST /api/queue/:id/status
  body: { status: "waiting"|"called"|"in_progress"|"done"|"skipped"|"cancelled" }
  → меняет статус; при "done" списывает склад по Service.stockUse и
    пересчитывает Master.avgServiceTimeMs скользящим средним

GET  /api/owner/today
  → { clientsServed, revenue, lowStock: [...] }
```

Socket.io: любой клиент подключается на тот же `API_URL`, слушает событие
`queue:update` — прилетает `{ masterId, queue: [...] }` с полным списком очереди
этого мастера. Фронтенд просто перерисовывает список на каждый эвент, без диффов.

## Edge-кейсы (специально упрощены под 3 часа)

- **No-show**: мастер жмёт "Не пришёл" → `status: "skipped"`, `skipCount += 1`,
  клиент уходит из активной очереди. Полноценного grace-периода на бэке нет —
  если будет время, добавить таймер на фронте мастера.
- **Отмена**: `status: "cancelled"` тем же эндпоинтом, слот просто перестаёт
  учитываться в выборке `/api/queue/:masterId` (фильтр по `waiting|called|in_progress`).
- **Офлайн**: НЕ делаем IndexedDB/CRDT — только optimistic UI на фронте мастера
  (кнопка меняет вид сразу, запрос ретраится) и баннер "нет связи". Это сознательное
  урезание под дедлайн, не забыть сказать об этом на питче.
- **Авторизация**: её нет. `/master/:masterId` и `/owner` — открытые URL без пароля,
  это демо на один салон.

## Переменные окружения (`/backend/.env`, не коммитить)

```
PORT=5000
MONGODB_URI=...       # MongoDB Atlas, придёт от Saidazim в личку
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SALON_ID=salon1
```

Фронтенды: `VITE_API_URL=http://localhost:5000` для разработки,
`VITE_API_URL=https://<render-url>` перед сборкой финальной версии.

## Деплой

Render free tier засыпает после 15 минут простоя — первый запрос после сна
поднимает его 30-50 секунд. Перед демо: зайти на прод-URL заранее и держать
вкладку открытой, иначе презентация повиснет на старте.

QR-код для демо генерируется на прод-URL `frontend-queue` (не на ngrok/локальный
адрес) — так он не зависит от сети докладчика и работает из любой точки зала.

## Что специально не делаем (осознанное урезание под 3 часа)

- Календарь/бронирование по слотам — вместо этого живая очередь без времени записи.
- Настоящий эквайринг — оплата отмечается вручную (нал/карта), без интеграции.
- Логин/регистрация клиента.
- Мультитенантность — один салон, ID зашит в `SALON_ID`.
