// src/routes/messages.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../db');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'dev_secret';

// Middleware admin (solo para consultar mensajes)
function adminAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado.' });
  try {
    const payload = jwt.verify(header.slice(7), SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado.' });
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido.' });
  }
}

// POST /api/messages — enviar mensaje de contacto (público)
router.post('/', async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message)
    return res.status(400).json({ error: 'Completa todos los campos.' });
  if (message.length > 2000)
    return res.status(400).json({ error: 'El mensaje es demasiado largo.' });

  try {
    const db = await getPool();
    await db.request()
      .input('name',    sql.NVarChar, name.trim())
      .input('email',   sql.NVarChar, email.toLowerCase().trim())
      .input('message', sql.NVarChar, message.trim())
      .query(`
        INSERT INTO messages (name, email, message)
        VALUES (@name, @email, @message)
      `);

    res.status(201).json({ ok: true, message: '¡Mensaje recibido! Te contactaremos pronto.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar el mensaje.' });
  }
});

// GET /api/messages — ver todos los mensajes (solo admin)
router.get('/', adminAuth, async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request()
      .query(`SELECT id, name, email, message, leido, created_at FROM messages ORDER BY created_at DESC`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mensajes.' });
  }
});

// PATCH /api/messages/:id/leido — marcar como leído (solo admin)
router.patch('/:id/leido', adminAuth, async (req, res) => {
  try {
    const db = await getPool();
    await db.request()
      .input('id', sql.Int, req.params.id)
      .query(`UPDATE messages SET leido = 1 WHERE id = @id`);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error.' });
  }
});

module.exports = router;
