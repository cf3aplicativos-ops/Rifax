# Registro de riesgos — RIFAX (rifax2)

Abierto el 2026-08-23 durante la auditoría retroactiva de la skill
`ciclo-software` (el proyecto no tenía este registro consolidado antes, pese a
tener hallazgos de seguridad reales ya documentados en `docs/bitacora.md`).

Impacto y probabilidad: alto / medio / bajo.

| # | Riesgo | Impacto | Prob. | Señal de alerta temprana | Mitigación | Dueño | Estado |
|---|--------|---------|-------|--------------------------|------------|-------|--------|
| 1 | 14 commits locales sin subir a `origin/rifax2` | Alto | Alta | `git status` mostrando "ahead N" | `git push` a `origin/rifax2` | Dueño | **cerrado en esta instrucción** (2026-08-23) |
| 2 | Sin CSP — documentado como pendiente desde el 2026-08-04, nunca aplicado | Medio | Media | Un XSS que hoy escapan correctamente (ver hallazgo del 2026-08-08) se volvería explotable si algún día se pasa por alto un escape | Aplicar cabeceras de seguridad (CSP como mínimo) en `next.config.ts` o middleware | Dueño | priorizado — dueño decidió (2026-08-23) cerrarlo antes de seguir con features nuevas |
| 3 | Token de reset de contraseña no es de un solo uso (mitigado solo por rate-limit) | Medio | Baja | Documentado por el propio proyecto desde 2026-08-04 | Invalidar el token tras el primer uso exitoso | Dueño | priorizado — dueño decidió (2026-08-23) cerrarlo antes de seguir con features nuevas |
| 4 | Credenciales de integraciones por tenant (Wompi, WhatsApp, SMS) sin cifrar en reposo | Alto | Baja | Una fuga de la base de datos expondría llaves de pago/mensajería de todas las empresas clientes | Cifrar `tenant_integraciones` a nivel de aplicación o de columna | Dueño | priorizado — dueño decidió (2026-08-23) cerrarlo antes de seguir con features nuevas |
| 5 | 12 vulnerabilidades de `npm audit` (11 high, 1 moderate); 3 de ellas (`next`, `nanoid`, `fast-uri`) tienen fix no-breaking disponible | Medio | Media | Alertas de `npm audit`/Dependabot si se activara | Actualizar `next` a 16.3.2 (resuelve 3 de las 11 high) y correr `npm audit fix` para `nanoid`/`fast-uri`; evaluar `nodemailer` (breaking) y aceptar la cadena de `prisma` (dev-only) como en SISMED | Dueño | priorizado — dueño decidió (2026-08-23) cerrarlo antes de seguir con features nuevas |
| 6 | Cero CI automatizada; `npm run build` no ejecuta ESLint | Alto | Alta | 3 errores de lint activos ahora mismo, sin que el build los detecte — ya había pasado antes (2026-08-06) | CI mínimo (GitHub Actions) que corra `build` + `lint` + `test` en cada push; corregir los 3 errores actuales | Dueño | priorizado — dueño decidió (2026-08-23) cerrarlo antes de seguir con features nuevas |
| 7 | Sin respaldo de Neon restaurado nunca en un simulacro | Alto | Baja | Un incidente real sería el primer intento de restauración | Confirmar ventana de PITR y ensayar una restauración | Pendiente | abierto |
| 8 | Sin monitoreo/alertas de infraestructura (sin Sentry/Analytics) | Alto | Media | Un error en producción se entera primero el cliente que el equipo — y aquí los "clientes" son empresas que venden rifas con dinero real | Instrumentar logging estructurado + alertas mínimas | Pendiente | abierto |
| 9 | Un solo dueño/operador aparente para todo el sistema (sin responsable de soporte definido) | Alto | Alta | Cualquier ausencia del dueño deja el sistema sin quién responda un incidente — con **dinero de terceros** de por medio (peor que SISMED en este punto: aquí hay pagos en línea reales) | Definir y documentar un responsable de soporte, aunque sea el mismo dueño con horario explícito | Pendiente | por confirmar |
| 10 | Wompi solo probado en sandbox; no hay confirmación de un pago real de punta a punta | Alto | Por confirmar | El primer pago real en producción sería la primera prueba completa del flujo | Probar con credenciales de sandbox reales antes de anunciar la función a clientes, o confirmar que ya se probó | Pendiente | por confirmar |
| 11 | Requisitos no funcionales y presupuesto nunca definidos | Medio | Media | No hay forma de saber si la infraestructura actual (plan Hobby de Vercel, mencionado en la bitácora por el límite de crons) alcanza para el crecimiento esperado | Cerrar Etapa 1 retroactivamente con números reales | Pendiente | abierto |
| 12 | Titularidad de cuentas GitHub/Vercel sin confirmar si es de la entidad o de una persona natural | Medio | Por confirmar | Relevante para continuidad si el negocio crece o cambia de responsable | Confirmar con el dueño | Pendiente | por confirmar |
| 13 | El núcleo original (`api/` en la raíz del repo) podría seguir desplegado en algún lado sin que esta auditoría lo haya cubierto | Medio | Por confirmar | Dos sistemas activos con el mismo dominio de negocio, uno auditado y otro no | Confirmar con el dueño que solo `rifax2` está en producción | Pendiente | por confirmar |

## Riesgos que casi siempre aplican (revisión contra la lista base de la skill)

- La integración con el sistema de un tercero no existe o no está documentada →
  **parcialmente aplica, ver #10** (Wompi documentado pero no probado de punta
  a punta con dinero real).
- El responsable funcional cambia durante el proyecto → no evaluado, ni
  siquiera está nombrado todavía (ver `estado.md`).
- El costo mensual de infraestructura supera lo presupuestado → no se puede
  evaluar, no hay presupuesto definido (ver #11). Nota real ya detectada por el
  propio proyecto: el plan Hobby de Vercel limita cuántos crons hay, lo que ya
  condicionó una decisión de diseño (reutilizar el cron existente en vez de
  crear uno nuevo para limpiar carritos abandonados).
- Nadie más que una persona sabe operar el sistema → **aplica, ver #9**, con
  mayor severidad que en SISMED porque aquí hay dinero de terceros (pagos en
  línea) moviéndose, no solo dinero interno de facturación en salud.
- Los datos de prueba son datos reales de personas → **mitigado, mejor que
  SISMED**: el arnés de pruebas funcionales crea y purga tenants desechables
  contra la base real, con limpieza verificada explícitamente después de cada
  corrida (no usa datos de clientes reales).
- La titularidad de dominios y cuentas queda en el proveedor → **por confirmar,
  ver #12**.
