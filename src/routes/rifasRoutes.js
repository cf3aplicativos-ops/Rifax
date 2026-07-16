'use strict';

const express = require('express');
const svc = require('../services/rifasService');
const { requireAuth, requirePermiso } = require('../middleware/authGuard');

const router = express.Router();

router.get('/', requireAuth, requirePermiso('rifa.ver'), async (req, res, next) => {
  try { res.json(await svc.listarRifas()); } catch (e) { next(e); }
});

router.post('/', requireAuth, requirePermiso('rifa.crear'), async (req, res, next) => {
  try { res.status(201).json(await svc.crearRifa(req.body, req.usuario)); } catch (e) { next(e); }
});

router.get('/:id', requireAuth, requirePermiso('rifa.ver'), async (req, res, next) => {
  try { res.json(await svc.obtenerRifa(Number(req.params.id))); } catch (e) { next(e); }
});

router.post('/:id/publicar', requireAuth, requirePermiso('rifa.publicar'), async (req, res, next) => {
  try { res.json(await svc.publicarRifa(Number(req.params.id), req.usuario)); } catch (e) { next(e); }
});

router.get('/:id/boletas/disponibles', requireAuth, requirePermiso('boleta.ver'), async (req, res, next) => {
  try {
    const cant = Number(req.query.cantidad || 10);
    res.json(await svc.boletasDisponibles(Number(req.params.id), cant));
  } catch (e) { next(e); }
});

module.exports = router;
