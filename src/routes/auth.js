// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../db');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'dev_secret';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { full_name, email, password } = req.body;
  if (!full_name || !email || !password)
    return res.status(400).json({ error: 'Completa todos los campos.' });

  try {
    const db = await getPool();

    const exists = await db.request()
      .input('email', sql.NVarChar, email.toLowerCase())
      .query('SELECT id FROM users WHERE email = @email');

    if (exists.recordset.length > 0)
      return res.status(409).json({ error: 'Ese correo ya está registrado.' });

    const hash = await bcrypt.hash(password, 12);

    const result = await db.request()
      .input('full_name', sql.NVarChar, full_name)
      .input('email',     sql.NVarChar, email.toLowerCase())
      .input('password',  sql.NVarChar, hash)
      .query(`
        INSERT INTO users (full_name, email, password)
        OUTPUT INSERTED.id, INSERTED.full_name, INSERTED.email, INSERTED.role, INSERTED.created_at
        VALUES (@full_name, @email, @password)
      `);

    const user = result.recordset[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos.' });

  try {
    const db = await getPool();

    const result = await db.request()
      .input('email', sql.NVarChar, email.toLowerCase())
      .query('SELECT * FROM users WHERE email = @email');

    const user = result.recordset[0];
    if (!user)
      return res.status(401).json({ error: 'Credenciales inválidas.' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
      return res.status(401).json({ error: 'Credenciales inválidas.' });

    const { password: _, ...safeUser } = user;
    const token = jwt.sign(
      { id: safeUser.id, email: safeUser.email, role: safeUser.role },
      SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: safeUser });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ error: 'No autorizado.' });

  try {
    const payload = jwt.verify(auth.slice(7), SECRET);
    const db = await getPool();

    const r = await db.request()
      .input('id', sql.Int, payload.id)
      .query('SELECT id, full_name, email, role, avatar_url, created_at FROM users WHERE id = @id');

    if (!r.recordset[0])
      return res.status(404).json({ error: 'Usuario no encontrado.' });

    res.json(r.recordset[0]);

  } catch {
    res.status(401).json({ error: 'Token inválido.' });
  }
});

module.exports = router;