'use strict';

/**
 * Punto de entrada para Vercel (Serverless Function).
 * Vercel no ejecuta app.listen(); en su lugar invoca este handler por request.
 * Reutilizamos la misma app Express exportada desde src/server.js.
 */
const app = require('../src/server');
module.exports = app;
