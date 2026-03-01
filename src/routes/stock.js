// src/routes/stock.js
const express = require('express');
const { getPool, sql } = require('../db');

const router = express.Router();

// GET /api/stock — devuelve el stock de todos los productos
router.get('/', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request()
      .query('SELECT id, en_stock FROM stock');

    // Convertir a objeto { 'bp-1': true, 'pv-2': false, ... }
    const stockMap = {};
    for (const row of result.recordset) {
      stockMap[row.id] = row.en_stock === true || row.en_stock === 1;
    }

    res.json(stockMap);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener stock.' });
  }
});

module.exports = router;
