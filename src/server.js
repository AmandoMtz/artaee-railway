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

// Acepta localhost Y cualquier subdominio de vercel.app
app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      origin.startsWith('http://localhost') ||
      origin.endsWith('.vercel.app') ||
      origin === process.env.FRONTEND_URL ||
      origin === 'https://artaee.com'
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date() }));

async function start() {
  try {
    await initDB();
    console.log('✅ Base de datos lista');
  } catch (err) {
    console.error('⚠️  No se pudo conectar a la BD:', err.message);
    console.error('El servidor arrancará igual pero las rutas de BD fallarán.');
  }

  app.listen(PORT, () => console.log(`🚀 Backend corriendo en puerto ${PORT}`));
}

start();
