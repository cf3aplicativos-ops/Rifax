'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, close } = require('../src/lib/db');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '0001_init.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migración aplicada correctamente.');
  await close();
})().catch((e) => { console.error('Fallo migración:', e.message); process.exit(1); });
