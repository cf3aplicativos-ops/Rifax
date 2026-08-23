# Estado del proyecto: RIFAX

> Este archivo es la memoria del proyecto entre sesiones (skill `ciclo-software`). Léelo
> al abrir y actualízalo al cerrar cada etapa. Si algo no está aquí, para efectos
> prácticos no se decidió.

- **Repositorio**: un solo repo git (`cf3aplicativos-ops/Rifax`) con dos aplicativos:
  - `api/`, `src/`, `db/` en la raíz — **"RIFAX API — Núcleo"**, el backend
    Node/Express original (18/18 e2e), descrito por su propio README como el
    dominio base. **Confirmado por el dueño (2026-08-23): no está en
    producción** — es solo referencia histórica de dominio. Esta auditoría no
    lo cubre más allá de esta nota.
  - **`rifax2/`** — **RIFAX 2**, reescritura completa en Next.js 16 + Prisma 7 +
    Neon, desplegada en Vercel (`https://rifax2.vercel.app`), rama `rifax2`. **Es el
    sistema real y activo**: SaaS multi-tenant de rifas con landing pública,
    portal de empresa, portal de vendedor, panel de super-admin, pagos en línea
    (Wompi), conciliación con IA, y una bitácora de 731 líneas con decenas de
    sesiones de trabajo reales. Este documento audita **`rifax2`**, no el núcleo
    original.
- **Tamaño**: **crítico** — confirmado por el dueño el 2026-08-23 (dinero real de
  terceros — ventas, comisiones, pagos en línea con Wompi —, datos personales de
  miles de compradores/vendedores de múltiples empresas cliente, multi-tenant en
  producción real).
- **Sector público colombiano**: no aplica — es un producto SaaS comercial privado
  (planes Básico/Corporativo con precios propios). Aplica igual la Ley 1581 por
  manejar datos personales de compradores y vendedores.
- **Etapa actual real**: en producción y con desarrollo activo diario. A
  diferencia de SISMED, **este proyecto sí tiene disciplina de verificación
  real** (protocolo "kit de pruebas en vivo" en `docs/bitacora.md`: build + tests
  + deploy + verificación en navegador contra producción, obligatorio antes de
  cerrar cualquier cambio) y **ya tuvo dos rondas reales de auditoría de 5
  especialistas** (`seguridad-appsec`, `backend-datos-prisma`, `frontend-nextjs`,
  `devops-vercel`, `calidad-qa`, en `.claude/agents/` + skill propio
  `.claude/skills/auditoria-especialistas/`) que encontraron y corrigieron
  vulnerabilidades reales (IDOR intra-tenant, condiciones de carrera en
  comisiones, falta de validación de sede). **Pese a eso, nunca existió `.ciclo/`
  ni un cierre formal de compuertas** — el rigor existe, pero disperso en la
  bitácora, no consolidado como exige esta skill.
- **Responsable funcional (decide [H])**: pendiente de confirmar.
- **Responsable técnico**: pendiente de confirmar (todo indica un solo dueño/
  operador, igual que en SISMED — ver `riesgos.md`).
- **Alcance**: SaaS multi-tenant (super-admin → empresas clientes → sedes →
  vendedores → clientes finales). 24 tablas de dominio (seguridad/RBAC, rifas,
  ventas, boletas, pagos, mensajería, cobranza, sorteos, IA, auditoría con hash
  encadenado). Documentado en detalle en `rifax2/docs/caracteristicas-funcionales.md`
  (422 líneas, buen nivel de detalle funcional) — pero sin una sección explícita
  de exclusiones ni de requisitos no funcionales numéricos (ver Etapa 1 abajo).

## Compuertas

Marcado a partir de evidencia real verificada en esta sesión (`npm run build`,
`npm test`, `npm run lint`, `npm audit`, `git log`, `git status`, lectura completa
de `docs/bitacora.md` y `docs/caracteristicas-funcionales.md`), no de intención.

### Etapa 1 — Requisitos y contexto
- [ ] Alcance escrito con exclusiones explícitas — `caracteristicas-funcionales.md`
      describe muy bien qué SÍ hace el sistema; no hay sección de qué queda
      explícitamente fuera
- [ ] Requisitos no funcionales con números — no se encontró concurrencia,
      volumen de tenants/ventas esperado, tiempo de respuesta objetivo ni
      disponibilidad objetivo en ningún documento
- [x] Clasificación de datos y norma aplicable — implícita pero consistente:
      aislamiento multi-tenant estricto, datos personales de vendedores marcados
      como sensibles (`vendedor.ver_pii`), Ley 1581 aplicaría por defecto (no está
      citada explícitamente en la documentación, a diferencia de SISMED)
- [ ] Lista de integraciones con estado real — Wompi (pagos), Groq (IA), SMTP
      (correo) están documentadas en el README con su variable de entorno, pero
      no hay un documento que diga cuáles están **realmente probadas en
      producción con datos reales** vs. solo configuradas: la propia bitácora
      admite que Wompi "no se pudo probar un pago real de punta a punta" (sin
      credenciales de sandbox) y que GROQ_API_KEY sí se verificó en vivo
      (2026-08-05)
- [ ] Fecha, presupuesto de construcción y de operación mensual — no encontrado
- [x] Riesgos iniciales registrados con dueño — parcialmente, como hallazgos
      dispersos de las auditorías de especialistas en `bitacora.md`; nunca
      consolidados en un registro único hasta este documento (`riesgos.md`)

**Compuerta 1: abierta.**

### Etapa 2 — Diseño
- [ ] Diagrama de arquitectura en el repo — no encontrado
- [x] Modelo de datos con restricciones de integridad — fuerte: 24 tablas,
      esquema SQL como fuente de verdad (`prisma/sql/0001_saas.sql` +
      24 migraciones aditivas numeradas), FKs compuestas `(id, tenant_id)`
      agregadas explícitamente en la auditoría de datos (migración `0017`) para
      impedir el cruce entre empresas **a nivel de base de datos**, no solo en
      código — más riguroso que el enfoque de SISMED
- [ ] Contrato de API acordado y versionado — no hay documento de contrato; las
      rutas API (`/api/...`) se descubren leyendo el código
- [x] Matriz de roles y permisos — sólida: roles (`admin`, `gerente`, `cajero`,
      `vendedor`, `auditor`, super-admin) con permisos granulares por acción
      (`rifa.crear`, `venta.anular`, `vendedor.ver_pii`, etc.), con overrides de
      permisos por usuario y bloqueos explícitos de rol (p. ej. `vendedor` nunca
      puede tener `pago.registrar_otra_sede` aunque un override se lo diera)
- [ ] Clasificación de datos sensibles y decisión de cifrado — datos de
      integraciones (`tenant_integraciones`: llaves de Wompi, tokens de
      WhatsApp/SMS) se guardan **sin cifrar en reposo**, decisión documentada
      explícitamente como aceptada "por ahora" (2026-08-11, punto 7), no como
      vacío — pero sigue siendo deuda sin fecha
- [ ] ADR de decisiones estructurales — no existe carpeta de ADRs; decisiones
      estructurales reales (SQL como fuente de verdad en vez de Prisma-first,
      esquema multi-tenant con `tenant_id` en cada tabla, hash encadenado de
      auditoría) están bien razonadas en README/bitácora pero no en formato ADR
      con alternativas descartadas

**Compuerta 2: abierta**, pero con el modelo de datos y la matriz de permisos
entre lo más sólido encontrado en cualquiera de los dos proyectos auditados con
esta skill hasta ahora.

### Etapa 3 — Entorno y disciplina
- [x] Repositorio con control de acceso — GitHub `cf3aplicativos-ops/Rifax`
- [x] Secretos fuera del código — `.gitignore` excluye `.env*`, `.vercel`,
      `/src/generated/prisma`; protocolo propio y explícito en `bitacora.md`
      ("nunca diagnosticar variables de entorno con `.env` local, solo contra
      Vercel") — más disciplina que SISMED en este punto específico
- [ ] Ambientes separados y documentados — no hay evidencia de un ambiente de
      *staging*/*preview* separado de producción; los despliegues son
      `vercel deploy --prod` directos según la bitácora
- [ ] Integración continua ejecutando pruebas — **no existe `.github/workflows/`**;
      la disciplina de build+test es 100% manual, sostenida por el protocolo
      escrito en `bitacora.md`, no automatizada. Además, **`npm run build` no
      ejecuta ESLint** (confirmado: hay 3 errores de lint activos ahora mismo —
      `react/no-unescaped-entities` x2 y `react-hooks/set-state-in-effect` x1 —
      que un build limpio no detecta), hallazgo que la propia auditoría de
      DevOps ya había señalado el 2026-08-06 sin que se haya corregido el
      proceso (solo se corrigieron los errores de esa fecha puntual)
- [x] Migraciones versionadas — a favor de Rifax: 24 archivos SQL numerados en
      `prisma/sql/`, aplicados con `prisma db execute` + `db pull` (SQL como
      fuente de verdad, documentado explícitamente en el README) — más disciplina
      que SISMED, que usa `db push` sin historial
- [ ] Otra persona puede levantar el proyecto con el README — el README de
      `rifax2` es bueno para *quien ya sabe qué es RIFAX*, pero no repite todo lo
      necesario para arrancar de cero (no menciona `npm test`/`test:functional`,
      remite a "Puesta en marcha" sin cubrir seed de datos ni cómo crear el
      primer super-admin)

**Compuerta 3: abierta**, pero con dos puntos fuertes reales (migraciones
versionadas, disciplina de secretos) que SISMED no tenía.

### Etapa 4 — Construcción
- [x] Rebanadas construidas y usadas — extremadamente avanzado: 24 migraciones,
      landing pública por empresa, dominio propio, compra en línea con Wompi,
      conciliación con IA, portal de vendedor completo, sistema de traspasos con
      autorización, comisiones con liquidación masiva, cartera, reportes — todo
      con entradas de bitácora detalladas por sesión
- [x] Pruebas unitarias e integración — **129/129 pruebas unitarias verificadas
      en esta sesión** (`npm test`, sin tocar la BD real) + una segunda suite
      "funcional" (`test/functional/`, 79 pruebas registradas en la última
      entrada) que corre contra **Neon real**, crea un tenant desechable y lo
      purga al final — un nivel de prueba que SISMED no tiene en absoluto
- [x] Migraciones aplicadas — 24 migraciones aditivas numeradas, aplicadas y
      verificadas contra la base real en cada sesión (con `EXPLAIN ANALYZE`,
      transacciones `BEGIN...ROLLBACK` de prueba antes de aplicar cambios
      arriesgados)
- [x] Revisión humana en autorización/dinero/datos sensibles — evidenciada:
      dos rondas completas de auditoría de 5 especialistas, con hallazgos reales
      corregidos (IDOR, condición de carrera en comisiones, validación de
      tenant/sede faltante)
- [ ] Supuestos abiertos resueltos o convertidos en riesgo — varios quedan
      igual que en SISMED: sin consolidar en un registro único hasta hoy
- [x] Documentación actualizada respecto a lo construido — sobresaliente
      comparado con SISMED: manual de usuario y "características funcionales"
      se actualizan en la misma sesión que el cambio de código, en varias
      entradas de la bitácora

**Compuerta 4: la más sólida de las dos auditorías hechas con esta skill —
construcción, pruebas y documentación avanzan juntas, no por separado.**

### Etapa 5 — Endurecimiento
- [x] Validación de entradas y protección XSS/CSRF **verificada activamente** —
      a diferencia de SISMED: se usa `zod` para validación de esquemas
      (`zod: ^4.4.3` en dependencias), y la auditoría de seguridad de 2026-08-08
      corrigió un XSS real (interpolación sin escapar de `nombre`/`password` en
      plantillas de correo HTML) con `escapeHtml()`
- [x] Matriz de permisos probada, incluyendo accesos denegados — verificado con
      lógica real: pruebas funcionales que confirman que un vendedor NO puede
      tener `pago.registrar_otra_sede`, que un admin de sede NO puede crear una
      rifa para otra sede (bug real encontrado y corregido), etc.
- [ ] Prueba de carga con números reales — no hecha (tampoco hay números de la
      Etapa 1 para hacerla contra ellos)
- [ ] Comportamiento ante saturación y caída de terceros — parcialmente: hay
      manejo de fallos de SMTP (no revierte el cambio de contraseña si el correo
      falla) y de Groq (mensaje claro si no hay `GROQ_API_KEY`), pero no hay
      evidencia de prueba de caída de Wompi o Neon bajo carga
- [ ] Dependencias sin vulnerabilidades críticas — **`npm audit --omit=dev`
      reporta 12 vulnerabilidades (11 "high", 1 "moderate")**, más que SISMED:
      - `next` (+ `postcss`, `sharp` que dependen de él) → fix **no-breaking**
        disponible: actualizar a `next@16.3.2` (hoy en `16.2.11`)
      - `nanoid`, `fast-uri` → `fixAvailable: true` (npm audit fix sin --force)
      - `nodemailer` → fix disponible pero **breaking** (9.0.5, usado en todos
        los correos transaccionales: reset de contraseña, avisos)
      - `@prisma/config`/`@prisma/dev`/`deepmerge-ts`/`find-my-way`/`valibot` →
        misma familia que en SISMED: cuelgan de `prisma` (CLI, `devDependency`),
        no de `@prisma/client`/`@prisma/adapter-pg` (lo que corre en
        producción); el único fix es downgrade breaking a `prisma@6.12.0`
- [x] Hallazgos abiertos con diagnóstico priorizado — mejor que SISMED: cada
      auditoría de especialista deja explícito qué se corrigió y qué se dejó
      pendiente **a propósito**, con la razón. Pendientes vigentes documentados
      por el propio proyecto: CSP nunca aplicado (confirmado en esta sesión —
      no hay cabeceras de seguridad en `next.config.ts` ni en ningún
      middleware), token de reset de contraseña no es de un solo uso (mitigado
      solo por rate-limit), y credenciales de integraciones (`tenant_integraciones`)
      sin cifrar en reposo

**Compuerta 5: abierta formalmente (nunca se "cerró" con una firma), pero es
la etapa con más trabajo real detrás de las dos auditorías hechas con esta
skill — la deuda que queda está identificada por el propio equipo, no
descubierta recién ahora.**

### Etapa 6 — Despliegue
- [x] Despliegue funcionando — producción real y viva en
      `https://rifax2.vercel.app`, con despliegues frecuentes (`vercel deploy
      --prod --scope rifa7 --yes`) documentados sesión a sesión
- [ ] Reversión de despliegue probada — no hay evidencia de un rollback
      ensayado (Vercel lo permite por diseño, pero no se ha probado a propósito)
- [ ] Restauración de respaldo probada con fecha — igual que SISMED: Neon
      ofrece PITR por plataforma, pero no hay evidencia de que se haya
      restaurado nunca como simulacro
- [ ] Registros, métricas y alertas activas — no se encontró Sentry, Vercel
      Analytics ni logger estructurado; la trazabilidad es el `AuditLog`
      aplicativo con hash encadenado (fuerte para *qué pasó*, no para
      *observabilidad de infraestructura/errores*)
- [x] Titularidad — GitHub `cf3aplicativos-ops` y Vercel (scope `rifa7`)
      parecen ser cuentas de la organización/dueño del proyecto, no de un
      tercero — **pendiente confirmar** si son de la entidad o de una persona
- [ ] Costo mensual real medido — no encontrado

**Compuerta 6: abierta**, mismo patrón que SISMED — el sistema está vivo y
tiene un ritmo de despliegue muy activo, pero sin la red de seguridad
operativa (alertas, respaldo probado, plan de reversión ensayado).

### Etapa 7 — Operación y entrega
- [ ] Documentación de operación probada por alguien externo — no existe
- [ ] Accesos y titularidades transferidos — desconocido
- [ ] Tablero de salud y métricas de propósito — no existe (más allá del
      panel de super-admin, que es del negocio, no de salud técnica del sistema)
- [x] Deuda técnica listada — mejor que SISMED: cada entrada de `bitacora.md`
      documenta explícitamente qué quedó pendiente y por qué, aunque nunca se
      consolidó en un solo lugar hasta este documento
- [ ] Presupuesto de operación aprobado — no encontrado
- [ ] Responsable de soporte definido y capacitado — no encontrado; todo indica
      un solo operador (ver `riesgos.md`)

**Compuerta 7: abierta**, esperable en un sistema con desarrollo activo diario.

## Decisiones cerradas

Reconstruidas desde `docs/bitacora.md` — decisiones `[H]` que sí quedaron
registradas con razón antes de esta auditoría.

| Fecha | Etapa | Decisión | Quién | Razón |
|-------|-------|----------|-------|-------|
| 2026-07-22 (aprox.) | 2 | Reescribir el núcleo original en Next.js + Prisma + Neon (`rifax2`) | Dueño | Aprovechar el dominio ya probado (18/18 e2e) del API original sobre un stack más productivo/desplegable |
| — | 2 | SQL como fuente de verdad, no `schema.prisma` a mano | Dueño/técnico | El esquema usa funciones, triggers y vistas que Prisma no puede expresar; se introspecciona con `db pull` |
| 2026-08-11 | 4 | Conciliación con IA: CSV en vez de Excel/PDF nativo | Dueño | `xlsx` tiene 2 CVE altos sin parche; se prefirió no agregar la dependencia |
| 2026-08-11 | 4 | Wompi solo en modo sandbox por ahora; solo instrucciones DNS para dominio propio, sin automatizarlo | Dueño | Decisión explícita antes de codear (documentada en la entrada del punto 4) |
| 2026-08-06 | 2 | Credenciales de integraciones (`tenant_integraciones`) sin cifrar en reposo por ahora | Implícito (no se corrigió tras señalarse) | "Si se requiere cifrado adicional es un cambio aparte" — deuda aceptada de facto, sin fecha |
| 2026-08-23 | 1 | El núcleo original (`api/`) no está en producción — solo `rifax2` es el sistema real | Dueño | Confirmado explícitamente; esta auditoría cubre `rifax2` sin dejar un sistema activo sin revisar |
| 2026-08-23 | 1 | Tamaño del proyecto: **crítico** | Dueño | Dinero real de terceros vía Wompi + datos personales multi-tenant en producción |
| 2026-08-23 | 5 | Prioridad de la deuda detectada (14 commits sin subir, lint, CSP, `npm audit`, cifrado de credenciales): **cerrar todo antes de seguir con features nuevas** | Dueño | Mismo criterio ya aplicado en SISMED; pasa a ser el alcance de la próxima instrucción de construcción |

## Supuestos abiertos

| Supuesto | Quién confirma | Fecha límite | Qué se rompe si es falso |
|----------|----------------|--------------|--------------------------|
| Las cuentas de GitHub (`cf3aplicativos-ops`) y Vercel (scope `rifa7`) están a nombre de la entidad dueña de RIFAX, no de una persona a título personal | Dueño | Antes de cerrar Etapa 6 | Riesgo de titularidad — ver `riesgos.md` |
| El responsable funcional y técnico de RIFAX es una sola persona (el dueño), igual que en SISMED | Dueño | Antes de cerrar Etapa 7 | Si hay más gente involucrada, cambia la clasificación del riesgo de "bus factor" |
| Wompi en producción real (no solo sandbox) ya se activó con clientes reales pagando | Dueño | Antes de dar por cerrada la Fase de pagos en línea | Si ya hay dinero real moviéndose sin haberse probado de punta a punta, es el riesgo más alto de todo el sistema |

## Desvíos aceptados

Huecos que la construcción avanzó sin cerrar formalmente. Se listan aquí para
pedir la autorización consciente que la skill exige.

| Fecha detectado | Qué se saltó | Por qué (evidencia) | Quién autoriza | Cuándo se retoma |
|---|---|---|---|---|
| 2026-08-23 | Requisitos no funcionales numéricos y presupuesto (Etapa 1) | Nunca se documentaron | Pendiente | Pendiente |
| 2026-08-23 | 14 commits locales sin subir a `origin/rifax2` | Confirmado con `git status` al iniciar esta auditoría | **Ya no es desvío aceptado** — Dueño decidió (2026-08-23) hacer push de inmediato | Cerrado en esta misma instrucción |
| 2026-08-23 | Cero CI automatizada; `npm run build` no corre ESLint (3 errores de lint activos ahora mismo) | Confirmado en esta sesión; ya señalado por el propio proyecto el 2026-08-06 sin corregirse el proceso | **Ya no es desvío aceptado** — Dueño decidió (2026-08-23) cerrarlo antes de seguir con features | Próxima instrucción |
| 2026-08-23 | CSP nunca aplicado | Documentado como pendiente desde 2026-08-04, confirmado que sigue sin aplicarse | **Ya no es desvío aceptado** — Dueño decidió (2026-08-23) cerrarlo antes de seguir con features | Próxima instrucción |
| 2026-08-23 | Token de reset de contraseña no es de un solo uso (mitigado solo por rate-limit) | Documentado desde 2026-08-04, sin cambiar por ser un cambio de comportamiento | **Ya no es desvío aceptado** — Dueño decidió (2026-08-23) cerrarlo antes de seguir con features | Próxima instrucción |
| 2026-08-23 | Credenciales de integraciones (Wompi/WhatsApp/SMS por tenant) sin cifrar en reposo | Decisión explícita "por ahora" del 2026-08-11, sin fecha de revisión | **Ya no es desvío aceptado** — Dueño decidió (2026-08-23) cerrarlo antes de seguir con features | Próxima instrucción |
| 2026-08-23 | 12 vulnerabilidades de `npm audit` (11 high, 1 moderate) sin resolver | Confirmado en esta sesión; algunas con fix no-breaking disponible (`next`, `nanoid`, `fast-uri`) | **Ya no es desvío aceptado** — Dueño decidió (2026-08-23) cerrarlo antes de seguir con features (la cadena de `prisma` CLI se documentará como riesgo bajo aceptado, mismo criterio que SISMED) | Próxima instrucción |
| 2026-08-23 | Sin respaldo restaurado nunca en simulacro, sin monitoreo/alertas de infraestructura | Mismo patrón que SISMED | Pendiente — requiere dashboard de Neon/Vercel | Pendiente |
| 2026-08-23 | Sin ADRs de decisiones estructurales | Decisiones bien razonadas en README/bitácora, no en formato ADR | Pendiente | Pendiente |

## Notas de auditoría (2026-08-23)

- Este documento se generó siguiendo `ciclo-software/SKILL.md` en **modo
  auditoría** — el proyecto ya estaba en marcha (y muy avanzado) y nadie llevaba
  este control formal, aunque sí existía una disciplina real e informal de
  calidad (protocolo de bitácora + kit de pruebas en vivo + auditorías de 5
  especialistas).
- **A diferencia de SISMED**, este proyecto llega a la auditoría con evidencia
  real de rigor ya aplicado: pruebas contra base de datos real, auditorías de
  seguridad que corrigieron vulnerabilidades reales (no solo diagnóstico),
  migraciones versionadas, y documentación que se actualiza junto con el
  código. El trabajo de esta skill aquí es sobre todo **consolidar y dar
  continuidad** a una disciplina que ya existía, más que destapar negligencia.
- El hallazgo más urgente no es técnico: **14 commits sin subir a origin**. Si
  el equipo de trabajo cambia de máquina (como ya le pasó a SISMED entre
  agentes/equipos), ese trabajo no tiene respaldo remoto todavía.
- No se modificó ningún archivo de código de la aplicación — esta instrucción
  fue exclusivamente de auditoría (se ejecutaron `npm run build`, `npm test`,
  `npm run lint` y `npm audit` de forma read-only, y se limpió el artefacto
  `.next` generado).
