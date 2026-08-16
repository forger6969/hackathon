require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const createQueueRouter = require('./routes/queue');
const ownerRouter = require('./routes/owner');
const catalogRouter = require('./routes/catalog');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

app.use('/api/queue', createQueueRouter(io));
app.use('/api/owner', ownerRouter);
app.use('/api', catalogRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

io.on('connection', (socket) => {
  console.log('client connected', socket.id);
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => console.log(`Navbat backend running on ${PORT}`));
});
