# RIFAX 2 — Plataforma de rifas (Next.js + Prisma + Neon)

Reescritura de [RIFAX API](../) sobre **Next.js (App Router) + Prisma + Neon**, desplegada en **Vercel**.
Toma como base de dominio el núcleo original (24 tablas: seguridad/RBAC, rifas, ventas,
boletas, pagos, mensajería, cobranza, sorteos, IA y auditoría con hash encadenado).

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS, `src/`)
- **Prisma 7** (generador `prisma-client` → `src/generated/prisma`)
- **Neon** (Postgres serverless) provisionado desde **Vercel** (integración Marketplace)
- **Vercel** (deploy) · **GitHub** `cf3aplicativos-ops/Rifax` (rama `rifax2`)

## Estrategia de esquema: **SQL como fuente de verdad**

El esquema de rifax usa funciones (auditoría con hash encadenado), triggers de
`updated_at`, vistas (`v_cartera`, `mv_avance_rifa`) y datos semilla que Prisma **no**
puede expresar en `schema.prisma`. Por eso:

1. La estructura vive en [`prisma/sql/0001_init.sql`](prisma/sql/0001_init.sql) (probado, 18/18 e2e en el API original).
2. Se aplica a Neon con `prisma db execute`.
3. `prisma db pull` **introspecta** la base y genera los modelos en `schema.prisma`.
4. `prisma generate` produce el cliente tipado que consume la app.

## Puesta en marcha

### 1. Base de datos Neon (desde Vercel)

En el panel de Vercel del proyecto → **Storage → Create Database → Neon**
(región São Paulo `sa-east-1`), conéctala al proyecto. Vercel inyecta
`DATABASE_URL` (pooled) y `DATABASE_URL_UNPOOLED` (directa).

### 2. Traer variables de entorno

```bash
vercel env pull .env
```

### 3. Aplicar esquema, introspectar y generar cliente

```bash
npx prisma db execute --file prisma/sql/0001_init.sql --schema prisma/schema.prisma
npx prisma db pull
npx prisma generate
```

### 4. Desarrollo

```bash
npm run dev
```

## Variables de entorno

| Variable                 | Uso                                        |
| ------------------------ | ------------------------------------------ |
| `DATABASE_URL`           | Conexión **pooled** (runtime de la app)    |
| `DATABASE_URL_UNPOOLED`  | Conexión **directa** (Prisma CLI / DDL / migraciones) |
| `JWT_SECRET`             | Firma de tokens de sesión                  |
| `CRON_SECRET`            | Autoriza `GET /api/cron/outbox` (header `Authorization: Bearer <valor>`) |
| `GROQ_API_KEY`           | Proveedor de IA (Groq, API compatible con OpenAI) para `/app/conciliacion` (plan Corporativo). Opcional: sin ella, la pantalla se muestra pero el análisis falla con un mensaje claro. |
| `SMTP_HOST`              | Servidor SMTP para envío de correo (p. ej. `smtp.gmail.com`). Opcional: sin `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD`, el correo se simula (log en consola) en vez de fallar. |
| `SMTP_PORT`              | Puerto SMTP: `587` (TLS, por defecto) o `465` (SSL). |
| `SMTP_SECURE`            | `"true"` para forzar SSL (puerto 465). Por defecto `false`. |
| `SMTP_USER`              | Cuenta remitente (login SMTP). |
| `SMTP_PASSWORD`          | Contraseña de aplicación del remitente (p. ej. Gmail App Password). |
| `MAIL_FROM`              | Remitente visible en los correos. Por defecto, igual a `SMTP_USER`. |

> `.env*` está en `.gitignore`: los secretos nunca se suben al repo.
