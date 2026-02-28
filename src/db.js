// src/db.js
require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    instanceName: process.env.DB_INSTANCE || undefined,
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
    console.log('✅ Conectado a SQL Server');
  }
  return pool;
}

async function initDB() {
  const db = await getPool();

  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
    CREATE TABLE users (
      id          INT IDENTITY(1,1) PRIMARY KEY,
      full_name   NVARCHAR(120)  NOT NULL,
      email       NVARCHAR(200)  NOT NULL UNIQUE,
      password    NVARCHAR(200)  NOT NULL,
      role        NVARCHAR(20)   DEFAULT 'customer',
      avatar_url  NVARCHAR(500)  NULL,
      created_at  DATETIME       DEFAULT GETDATE()
    )
  `);

  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' AND xtype='U')
    CREATE TABLE orders (
      id          INT IDENTITY(1,1) PRIMARY KEY,
      user_id     INT            NOT NULL REFERENCES users(id),
      status      NVARCHAR(50)   DEFAULT 'pendiente',
      total       DECIMAL(10,2)  NOT NULL,
      notes       NVARCHAR(500)  NULL,
      created_at  DATETIME       DEFAULT GETDATE(),
      updated_at  DATETIME       DEFAULT GETDATE()
    )
  `);

  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='order_items' AND xtype='U')
    CREATE TABLE order_items (
      id           INT IDENTITY(1,1) PRIMARY KEY,
      order_id     INT            NOT NULL REFERENCES orders(id),
      product_name NVARCHAR(200)  NOT NULL,
      price        DECIMAL(10,2)  NOT NULL,
      quantity     INT            NOT NULL DEFAULT 1,
      size         NVARCHAR(20)   NULL
    )
  `);

  console.log('✅ Tablas verificadas/creadas');
}
module.exports = { getPool, initDB, sql };
