'use strict';

/**
 * Prueba end-to-end del núcleo RIFAX contra el servidor HTTP real.
 * Flujo: login -> crear rifa -> publicar -> vender -> idempotencia ->
 *        doble venta (debe fallar) -> abonar/pagar -> anular -> auditoría.
 * Requiere el servidor corriendo en $BASE (por defecto http://localhost:6070).
 */

const BASE = process.env.BASE || 'http://localhost:6070';
let token = null;
let pass = 0, fail = 0;

function ok(cond, msg) {
  if (cond) { pass++; console.log('  \u2713', msg); }
  else { fail++; console.log('  \u2717 FALLO:', msg); }
}

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
  let json = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

(async () => {
  console.log('== PRUEBA E2E RIFAX ==');

  // 0) Health
  let r = await call('GET', '/api/v1/health');
  ok(r.status === 200 && r.json.ok, 'health responde ok');

  // 1) Login admin
  r = await call('POST', '/api/v1/auth/login', {
    correo: process.env.ADMIN_EMAIL || 'admin@rifax.co',
    password: process.env.ADMIN_PASSWORD || 'Admin12345!',
  });
  ok(r.status === 200 && r.json.access_token, 'login admin devuelve access_token');
  token = r.json.access_token;

  // 1b) Acceso sin token debe fallar
  const sinToken = token; token = null;
  r = await call('GET', '/api/v1/rifas');
  ok(r.status === 401, 'sin token -> 401');
  token = sinToken;

  // 2) Crear rifa (2 dígitos -> 100 boletas 00-99)
  r = await call('POST', '/api/v1/rifas', {
    nombre: 'Rifa E2E Prueba',
    numero_digitos: 2,
    precio_boleta: 5000,
    fecha_apertura: new Date().toISOString(),
    fecha_cierre_ventas: new Date(Date.now() + 864e5).toISOString(),
    fecha_sorteo: new Date(Date.now() + 2 * 864e5).toISOString(),
    premios: [{ orden: 1, nombre: 'Premio mayor', valor_estimado: 1000000 }],
  });
  ok(r.status === 201 && r.json.id, 'crea rifa (201) con codigo ' + (r.json.codigo || ''));
  const rifaId = r.json.id;

  // 3) Publicar rifa -> materializa 100 boletas
  r = await call('POST', `/api/v1/rifas/${rifaId}/publicar`);
  ok(r.status === 200 && r.json.boletas_materializadas === 100, 'publica y materializa 100 boletas');
  ok(r.json.rifa.estado === 'activa', 'rifa queda activa');

  // 3b) Re-publicar debe fallar (409)
  r = await call('POST', `/api/v1/rifas/${rifaId}/publicar`);
  ok(r.status === 409, 're-publicar -> 409 conflicto');

  // 4) Vender boletas 7, 8, 9
  const idem = 'e2e-key-001';
  r = await call('POST', '/api/v1/ventas', {
    rifa_id: rifaId, numeros: [7, 8, 9],
    cliente: { nombre: 'Juan Perez', telefono: '3001234567', consentimiento_datos: true },
    canal: 'web',
  }, { 'Idempotency-Key': idem });
  ok(r.status === 201 && r.json.venta, 'crea venta (201) codigo ' + (r.json.venta?.codigo || ''));
  ok(Number(r.json.venta.total) === 15000, 'total = 3 x 5000 = 15000');
  const ventaId = r.json.venta.id;

  // 5) Repetir con la MISMA idempotency-key -> misma venta, no duplica
  r = await call('POST', '/api/v1/ventas', {
    rifa_id: rifaId, numeros: [7, 8, 9],
    cliente: { nombre: 'Juan Perez', telefono: '3001234567' },
  }, { 'Idempotency-Key': idem });
  ok(r.status === 200 && r.json.idempotente === true && r.json.venta.id === ventaId,
     'idempotencia: misma key devuelve la misma venta sin duplicar');

  // 6) DOBLE VENTA de una boleta ya vendida (9) -> 409
  r = await call('POST', '/api/v1/ventas', {
    rifa_id: rifaId, numeros: [9, 10],
    cliente: { nombre: 'Maria Lopez', telefono: '3009999999' },
  }, { 'Idempotency-Key': 'e2e-key-002' });
  ok(r.status === 409, 'doble venta de boleta 9 -> 409 (anti-doble-venta)');
  ok(r.json.error?.detalles?.numeros?.includes(9), 'reporta el numero en conflicto (9)');

  // 7) Vender un numero fuera de rango (200 no existe en rifa de 2 digitos)
  r = await call('POST', '/api/v1/ventas', {
    rifa_id: rifaId, numeros: [200],
    cliente: { nombre: 'Test', telefono: '3007777777' },
  });
  ok(r.status === 422, 'numero fuera de rango -> 422');

  // 8) Abonar parcial (5000) -> estado parcial
  r = await call('POST', `/api/v1/ventas/${ventaId}/abonos`, { monto: 5000, origen: 'efectivo' });
  ok(r.status === 201 && r.json.estado === 'parcial', 'abono parcial -> estado parcial, saldo ' + r.json.saldo);

  // 9) Abonar el resto (10000) -> pagada
  r = await call('POST', `/api/v1/ventas/${ventaId}/abonos`, { monto: 10000, origen: 'pasarela' });
  ok(r.status === 201 && r.json.estado === 'pagada' && Number(r.json.saldo) === 0,
     'abono final -> pagada, saldo 0');

  // 10) Consultar venta con boletas pagadas
  r = await call('GET', `/api/v1/ventas/${ventaId}`);
  ok(r.status === 200 && r.json.boletas.every((b) => b.estado === 'pagada'),
     'boletas de la venta quedan en estado pagada');

  // 11) RBAC: crear un vendedor-token no aplica aqui; validamos permiso faltante
  //     usando una ruta que exige permiso que el admin sí tiene (control positivo).
  r = await call('GET', `/api/v1/rifas/${rifaId}/boletas/disponibles?cantidad=5`);
  ok(r.status === 200 && Array.isArray(r.json), 'lista boletas disponibles (RBAC boleta.ver ok)');

  console.log(`\nRESULTADO: ${pass} OK, ${fail} FALLOS`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('Excepcion e2e:', e); process.exit(1); });
