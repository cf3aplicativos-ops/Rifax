'use strict';

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const rifasRoutes = require('./routes/rifasRoutes');
const ventasRoutes = require('./routes/ventasRoutes');

const app = express();

// Seguridad de borde y parseo
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Salud
app.get('/api/v1/health', (_req, res) => res.json({ ok: true, servicio: 'rifax-api', ts: new Date().toISOString() }));

// Rutas de dominio
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/rifas', rifasRoutes);
app.use('/api/v1/ventas', ventasRoutes);

// 404 y errores
app.use((_req, res) => res.status(404).json({ error: { codigo: 'NOT_FOUND', mensaje: 'Ruta no encontrada' } }));
app.use(errorHandler);

const PORT = Number(process.env.PORT || 6070);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`RIFAX API escuchando en http://localhost:${PORT}`);
  });
}

module.exports = app;
