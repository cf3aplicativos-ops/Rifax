'use strict';

const express = require('express');
const svc = require('../services/ventasService');
const { requireAuth, requirePermiso } = require('../middleware/authGuard');

const router = express.Router();

router.post('/', requireAuth, requirePermiso('venta.crear'), async (req, res, next) => {
  try {
    const idem = req.headers['idempotency-key'] || null;
    const resultado = await svc.crearVenta(req.body, req.usuario, idem);
    res.status(resultado.idempotente ? 200 : 201).json(resultado);
  } catch (e) { next(e); }
});

router.get('/:id', requireAuth, requirePermiso('venta.ver'), async (req, res, next) => {
  try { res.json(await svc.obtenerVenta(Number(req.params.id))); } catch (e) { next(e); }
});

router.post('/:id/abonos', requireAuth, requirePermiso('pago.registrar'), async (req, res, next) => {
  try { res.status(201).json(await svc.registrarAbono(Number(req.params.id), req.body, req.usuario)); }
  catch (e) { next(e); }
});

router.post('/:id/anular', requireAuth, requirePermiso('venta.anular'), async (req, res, next) => {
  try { res.json(await svc.anularVenta(Number(req.params.id), req.body?.motivo, req.usuario)); }
  catch (e) { next(e); }
});

module.exports = router;
