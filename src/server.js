// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL, // tu URL de Vercel, ej: https://artaee.vercel.app
].filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date() }));

async function start() {
  try {
    await initDB();
    app.listen(PORT, () => console.log(`🚀 Backend en http://localhost:${PORT}`));
  } catch (err) {
    console.error('Error al iniciar:', err);
    process.exit(1);
  }
}

start();
