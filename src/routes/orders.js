// src/routes/orders.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { getPool, sql } = require('../db');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'dev_secret';

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado.' });
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido.' });
  }
}

// POST /api/orders — crear pedido
router.post('/', auth, async (req, res) => {
  const { items, notes } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'El carrito está vacío.' });

  const total = items.reduce((acc, it) => acc + (it.price * (it.quantity || 1)), 0);

  try {
    const db = await getPool();

    // Crear la orden
    const orderResult = await db.request()
      .input('user_id', sql.Int, req.user.id)
      .input('total',   sql.Decimal(10, 2), total)
      .input('notes',   sql.NVarChar, notes || null)
      .query(`
        INSERT INTO orders (user_id, total, notes)
        OUTPUT INSERTED.id, INSERTED.status, INSERTED.created_at
        VALUES (@user_id, @total, @notes)
      `);

    const order = orderResult.recordset[0];

    // Insertar cada item del carrito
    for (const item of items) {
      await db.request()
        .input('order_id',     sql.Int,          order.id)
        .input('product_name', sql.NVarChar,      item.name)
        .input('price',        sql.Decimal(10,2), item.price)
        .input('quantity',     sql.Int,           item.quantity || 1)
        .input('size',         sql.NVarChar,      item.size || null)
        .query(`
          INSERT INTO order_items (order_id, product_name, price, quantity, size)
          VALUES (@order_id, @product_name, @price, @quantity, @size)
        `);
    }

    res.status(201).json({ ...order, total, items });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear el pedido.' });
  }
});

// GET /api/orders — mis pedidos
router.get('/', auth, async (req, res) => {
  try {
    const db = await getPool();

    const result = await db.request()
      .input('user_id', sql.Int, req.user.id)
      .query(`
        SELECT o.id, o.status, o.total, o.notes, o.created_at,
               oi.product_name, oi.price as item_price, oi.quantity, oi.size
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.user_id = @user_id
        ORDER BY o.created_at DESC
      `);

    // Agrupar items por pedido
    const map = new Map();
    for (const row of result.recordset) {
      if (!map.has(row.id)) {
        map.set(row.id, {
          id: row.id,
          status: row.status,
          total: row.total,
          notes: row.notes,
          created_at: row.created_at,
          items: []
        });
      }
      if (row.product_name) {
        map.get(row.id).items.push({
          product_name: row.product_name,
          price: row.item_price,
          quantity: row.quantity,
          size: row.size,
        });
      }
    }

    res.json(Array.from(map.values()));

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pedidos.' });
  }
});

// GET /api/orders/:id — detalle de un pedido
router.get('/:id', auth, async (req, res) => {
  try {
    const db = await getPool();

    const r = await db.request()
      .input('id',      sql.Int, req.params.id)
      .input('user_id', sql.Int, req.user.id)
      .query(`
        SELECT o.*, oi.product_name, oi.price as item_price, oi.quantity, oi.size
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.id = @id AND o.user_id = @user_id
      `);

    if (!r.recordset.length)
      return res.status(404).json({ error: 'Pedido no encontrado.' });

    const first = r.recordset[0];
    const order = {
      id: first.id,
      status: first.status,
      total: first.total,
      notes: first.notes,
      created_at: first.created_at,
      items: r.recordset
        .filter(row => row.product_name)
        .map(row => ({
          product_name: row.product_name,
          price: row.item_price,
          quantity: row.quantity,
          size: row.size,
        }))
    };

    res.json(order);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error.' });
  }
});

module.exports = router;