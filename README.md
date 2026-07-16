# RIFAX API — Núcleo del aplicativo

API núcleo de la plataforma de rifas masivas: **autenticación + RBAC**, **gestión de rifas** (creación y publicación con materialización transaccional de boletas) y **ventas** (flujo idempotente, anti-doble-venta, abonos y anulación), con **auditoría de hash encadenado** y **outbox transaccional** de notificaciones.

Este es el backend Node.js/Express que implementa lo definido en la especificación técnica y usa el esquema de `migracion_rifax_v1.sql`. Está probado de extremo a extremo (18/18 pruebas).

## Requisitos

- Node.js 20+
- PostgreSQL (local para pruebas) o **Neon** (producción)

## Instalación rápida

### En Windows (con los .bat, tu flujo habitual)
1. `instalar.bat` — instala dependencias y crea `.env` desde `.env.example`.
2. Edita `.env` y coloca tu `DATABASE_URL` (cadena *pooled* de Neon en producción).
3. `migrar.bat` — aplica el esquema y crea el usuario admin.
4. `iniciar.bat` — levanta la API. (`iniciar-oculto.vbs` la corre sin ventana.)
5. `probar.bat` — corre la prueba end-to-end.

### En Linux/Mac o manual
```bash
npm install
cp .env.example .env          # edita DATABASE_URL
npm run migrate               # aplica db/0001_init.sql
npm run seed:admin            # crea admin@rifax.co / Admin12345!
npm start                     # levanta la API (puerto 6070 por defecto)
npm run test:e2e              # requiere servidor arriba en $BASE
node test/run_all.js          # servidor + prueba en un solo proceso
```

## Variables de entorno (`.env`)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión Postgres/Neon (pooled) |
| `JWT_SECRET` | Secreto de firma de JWT (largo y aleatorio) |
| `ACCESS_TOKEN_TTL` | Vigencia del access token en segundos (900) |
| `PORT` | Puerto de la API (6070) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Credenciales del admin sembrado |

## Estructura

```
src/
  lib/       db.js (pool+transacciones), auth.js (bcrypt+JWT), audit.js, errors.js
  services/  rifasService.js, ventasService.js   (lógica de dominio)
  routes/    authRoutes.js, rifasRoutes.js, ventasRoutes.js
  middleware/ authGuard.js (JWT+RBAC), errorHandler.js (mapea errores PG)
  server.js  ensamblado Express
db/
  0001_init.sql  (esquema completo)  migrate.js  seed_admin.js
test/
  run_all.js  (servidor + e2e en un proceso)   e2e.js (contra servidor externo)
scripts/  *.bat, *.vbs  (Windows)
```

## Endpoints implementados

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/api/v1/health` | — | Estado del servicio |
| POST | `/api/v1/auth/login` | — | Login, devuelve JWT |
| GET | `/api/v1/rifas` | `rifa.ver` | Lista rifas |
| POST | `/api/v1/rifas` | `rifa.crear` | Crea rifa (borrador) |
| GET | `/api/v1/rifas/:id` | `rifa.ver` | Detalle + premios |
| POST | `/api/v1/rifas/:id/publicar` | `rifa.publicar` | Materializa boletas y activa |
| GET | `/api/v1/rifas/:id/boletas/disponibles` | `boleta.ver` | Números disponibles |
| POST | `/api/v1/ventas` | `venta.crear` | Vende boletas (idempotente) |
| GET | `/api/v1/ventas/:id` | `venta.ver` | Detalle de venta |
| POST | `/api/v1/ventas/:id/abonos` | `pago.registrar` | Registra abono; paga si saldo=0 |
| POST | `/api/v1/ventas/:id/anular` | `venta.anular` | Anula y libera boletas |

**Cabecera `Idempotency-Key`** obligatoria/recomendada en `POST /ventas`.

## Garantías verificadas (prueba e2e, 18/18)

- Login y RBAC (401 sin token, permisos por endpoint).
- Publicación materializa exactamente las boletas del rango; re-publicar da 409.
- Venta calcula total, es idempotente por `Idempotency-Key`.
- **Anti-doble-venta**: vender una boleta ya vendida devuelve 409 con el número en conflicto.
- Número fuera de rango → 422.
- Abonos parciales → estado `parcial`; abono final → `pagada`, saldo 0, boletas `pagada`.
- Anular sin motivo → 422.
- **Auditoría con hash encadenado íntegra** tras todas las operaciones.
- **Outbox** genera `venta.creada` y `venta.pagada`.

## Despliegue en Vercel/Neon

- Usar la cadena **pooled** de Neon en `DATABASE_URL` (con `sslmode=require`; el pool activa SSL automáticamente).
- Cargar todas las variables en el panel de Vercel (dev/preview/prod).
- Para funciones serverless puras, la capa `src/lib/db.js` puede migrarse a `@neondatabase/serverless` sin tocar los servicios.

## Próximos módulos (no incluidos en este núcleo)

Vendedores/talonarios, pasarela y webhooks de pago, conciliación IA con Groq, mensajería WhatsApp/SMS/correo, cartera/cobranza, sorteo y reportería. El núcleo actual deja el patrón (servicios + rutas + auditoría + outbox) listo para extenderlos.
