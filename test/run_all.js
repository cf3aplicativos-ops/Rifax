'use strict';

// Levanta el servidor en el mismo proceso y ejecuta el flujo e2e.
require('dotenv').config();
const app = require('../src/server');
const { close } = require('../src/lib/db');

const PORT = 6099;
const BASE = `http://localhost:${PORT}`;
let token = null;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  \u2713', m); } else { fail++; console.log('  \u2717 FALLO:', m); } };

async function call(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

async function run() {
  console.log('== PRUEBA E2E RIFAX ==');
  let r = await call('GET', '/api/v1/health');
  ok(r.status === 200 && r.json.ok, 'health responde ok');

  r = await call('POST', '/api/v1/auth/login', { correo: 'admin@rifax.co', password: 'Admin12345!' });
  ok(r.status === 200 && r.json.access_token, 'login admin devuelve access_token');
  token = r.json.access_token;

  const saved = token; token = null;
  r = await call('GET', '/api/v1/rifas');
  ok(r.status === 401, 'sin token -> 401');
  token = saved;

  r = await call('POST', '/api/v1/rifas', {
    nombre: 'Rifa E2E', numero_digitos: 2, precio_boleta: 5000,
    fecha_apertura: new Date().toISOString(),
    fecha_cierre_ventas: new Date(Date.now() + 864e5).toISOString(),
    fecha_sorteo: new Date(Date.now() + 2 * 864e5).toISOString(),
    premios: [{ orden: 1, nombre: 'Premio mayor', valor_estimado: 1000000 }],
  });
  ok(r.status === 201 && r.json.id, 'crea rifa (201) codigo ' + (r.json.codigo || ''));
  const rifaId = r.json.id;

  r = await call('POST', `/api/v1/rifas/${rifaId}/publicar`);
  ok(r.status === 200 && r.json.boletas_materializadas === 100, 'publica y materializa 100 boletas');
  ok(r.json.rifa && r.json.rifa.estado === 'activa', 'rifa queda activa');

  r = await call('POST', `/api/v1/rifas/${rifaId}/publicar`);
  ok(r.status === 409, 're-publicar -> 409 conflicto');

  const idem = 'e2e-key-001';
  r = await call('POST', '/api/v1/ventas', {
    rifa_id: Number(rifaId), numeros: [7, 8, 9],
    cliente: { nombre: 'Juan Perez', telefono: '3001234567', consentimiento_datos: true },
    canal: 'web',
  }, { 'Idempotency-Key': idem });
  ok(r.status === 201 && r.json.venta, 'crea venta (201) codigo ' + (r.json.venta?.codigo || ''));
  ok(Number(r.json.venta.total) === 15000, 'total = 3 x 5000 = 15000');
  const ventaId = r.json.venta.id;

  r = await call('POST', '/api/v1/ventas', {
    rifa_id: Number(rifaId), numeros: [7, 8, 9],
    cliente: { nombre: 'Juan Perez', telefono: '3001234567' },
  }, { 'Idempotency-Key': idem });
  ok(r.status === 200 && r.json.idempotente === true && r.json.venta.id === ventaId,
     'idempotencia: misma key no duplica la venta');

  r = await call('POST', '/api/v1/ventas', {
    rifa_id: Number(rifaId), numeros: [9, 10],
    cliente: { nombre: 'Maria Lopez', telefono: '3009999999' },
  }, { 'Idempotency-Key': 'e2e-key-002' });
  ok(r.status === 409, 'doble venta de boleta 9 -> 409 (anti-doble-venta)');
  ok(r.json.error?.detalles?.numeros?.includes(9), 'reporta numero en conflicto (9)');

  r = await call('POST', '/api/v1/ventas', {
    rifa_id: Number(rifaId), numeros: [200],
    cliente: { nombre: 'Test', telefono: '3007777777' },
  });
  ok(r.status === 422, 'numero fuera de rango -> 422');

  r = await call('POST', `/api/v1/ventas/${ventaId}/abonos`, { monto: 5000, origen: 'efectivo' });
  ok(r.status === 201 && r.json.estado === 'parcial', 'abono parcial -> estado parcial, saldo ' + r.json.saldo);

  r = await call('POST', `/api/v1/ventas/${ventaId}/abonos`, { monto: 10000, origen: 'pasarela' });
  ok(r.status === 201 && r.json.estado === 'pagada' && Number(r.json.saldo) === 0, 'abono final -> pagada, saldo 0');

  r = await call('GET', `/api/v1/ventas/${ventaId}`);
  ok(r.status === 200 && r.json.boletas.every((b) => b.estado === 'pagada'), 'boletas quedan pagadas');

  r = await call('POST', `/api/v1/ventas/${ventaId}/anular`, {});
  ok(r.status === 422, 'anular sin motivo -> 422');

  r = await call('GET', `/api/v1/rifas/${rifaId}/boletas/disponibles?cantidad=5`);
  ok(r.status === 200 && Array.isArray(r.json) && !r.json.includes(7), 'boletas disponibles excluye la vendida (7)');

  console.log(`\nRESULTADO: ${pass} OK, ${fail} FALLOS`);
}

const server = app.listen(PORT, async () => {
  try {
    await run();
  } catch (e) {
    console.error('Excepcion:', e);
    fail++;
  } finally {
    server.close();
    await close();
    process.exit(fail === 0 ? 0 : 1);
  }
});
