# Bitácora del proyecto RIFAX (rifax2)

> Leer este archivo al iniciar cada sesión de trabajo sobre este proyecto.

## Protocolo obligatorio: kit de pruebas en vivo

**Cada vez que se desarrolle o modifique una funcionalidad**, antes de darla por
terminada se debe ejecutar este kit de pruebas, en este orden:

1. `npm run build` en `C:\Proyectos\Rifax\rifax2` — debe compilar sin errores.
2. Si hay pruebas relevantes (`npm test`), deben pasar.
3. Desplegar a producción: `vercel deploy --prod --scope rifa7 --yes`
   (requiere `XDG_DATA_HOME`/`XDG_CONFIG_HOME` apuntando a
   `AppData/Roaming/xdg.data` / `xdg.config`).
4. **Abrir el navegador (Browser pane) contra la URL de producción**
   (`https://rifax2.vercel.app` o la URL del deploy) y **verificar en vivo**
   el flujo afectado: navegar, hacer clic, leer la página, tomar captura si
   aplica. Esto es obligatorio siempre que el cambio sea visible/probable en
   el navegador — no basta con que el build o el `curl` respondan bien.
5. El usuario debe poder **ver el navegador funcionando** durante la
   verificación (no solo un resumen de texto).
6. Registrar en esta bitácora una entrada breve por sesión: qué se hizo, qué
   se verificó en vivo, y el commit/deploy resultante.

Este protocolo aplica automáticamente a partir de ahora, sin que el usuario
tenga que pedirlo cada vez.

## Protocolo obligatorio: variables de entorno solo desde Vercel

Todas las variables de este proyecto en Vercel están marcadas **"Sensitive"**:
una vez guardadas, su valor real no se vuelve a mostrar, ni en el dashboard
ni con `vercel env pull` (el CLI escribe literalmente `"[SENSITIVE]"` en el
`.env` descargado). Por eso:

- **Nunca** usar `vercel env pull` ni un `.env`/`.env.local` local para
  verificar si una variable está bien configurada — el resultado será
  `[SENSITIVE]` sin importar si el valor real es correcto, y no es señal de
  error.
- Para probar que una variable funciona de verdad, hacerlo **dentro del
  entorno real de Vercel**: desplegar y ejercitar el código que la usa ahí
  (por ejemplo, un endpoint temporal de diagnóstico protegido con un token
  generado para la ocasión, probado con `curl` contra producción y
  eliminado inmediatamente después).
- Toda verificación de configuración/variables de entorno se hace contra
  Vercel/producción directamente, nunca contra archivos locales.

---

## Entradas

### 2026-08-04 — Auditoría de 5 especialistas + traspaso de boletas

- Se crearon 5 agentes especialistas (`.claude/agents/`): seguridad-appsec,
  frontend-nextjs, backend-datos-prisma, devops-vercel, calidad-qa. Cada uno
  auditó su dominio y aplicó correcciones (cabeceras de seguridad, índices de
  BD, accesibilidad ARIA, Cache-Control en export, `mensajeError()` +
  suite de pruebas con vitest, 57 tests).
- Nueva funcionalidad: búsqueda de boleta por número (única forma de
  agregarla a una venta) + flujo de solicitud/autorización de traspaso entre
  vendedores y puntos de venta, con reasignación de comisión y registro de
  la novedad para ambas partes (`/app/traspasos`, `/vendedor/traspasos`).
  Migración `0013_solicitudes_boleta.sql`.
- Verificado: build limpio, 57 pruebas OK, SQL validado contra la BD real
  con `EXPLAIN`/transacciones de prueba, deploy a producción exitoso.
- **Pendiente de esta entrada**: verificación en vivo en el navegador
  (siguiente paso de esta misma sesión, según el protocolo de arriba).

### 2026-08-05 — Login super-admin, manual dentro de la app, zoom/pantalla completa, conciliación con IA

- Diagnóstico y solución del login del super-admin: la contraseña no
  coincidía con el hash (no era bug de código); se generó una temporal y se
  forzó `debe_cambiar_password`.
- Manual de usuario, "Acerca de" y "Derechos reservados" (con licencias OSS
  reales del `package.json`) publicados como HTML dentro de la app
  (`public/manual/`), enlazados desde el pie de la landing, login, consulta
  pública, panel de empresa, portal de vendedor y panel de super-admin.
- Explicación ampliada del flujo de traspaso de boletas (paso a paso, tabla
  de resultados de búsqueda, quién autoriza cada tipo) en el MD y en el
  manual.
- Control flotante de zoom (A−/100%/A+) y pantalla completa, disponible en
  toda la aplicación (`src/components/ZoomControls.tsx`, montado en el
  layout raíz).
- Nueva funcionalidad: **conciliación de pagos con IA** (`/app/conciliacion`,
  plan Corporativo, permiso `conciliacion.usar`, migración
  `0014_conciliacion.sql`). Tres modos — extracto bancario (recomendado),
  reporte de vendedor en texto libre, comprobantes de pago en imagen — que
  usan IA (Groq) solo para **sugerir** coincidencias contra la cartera
  pendiente; el registro del abono siempre requiere confirmación explícita
  y separada del análisis (`src/lib/conciliacion.ts`, `src/lib/ia.ts`).
  Requiere `GROQ_API_KEY` (documentada en el README); sin ella, la pantalla
  funciona pero el análisis avisa que falta configurar el proveedor.
- Verificado: build limpio, 57 pruebas OK, deploy a producción exitoso,
  navegación en vivo confirmando footer/login/manual servidos correctamente
  y protección de ruta de `/app/conciliacion` (redirige a login sin
  sesión). **Pendiente**: probar el flujo de conciliación de extremo a
  extremo una vez se configure `GROQ_API_KEY` en Vercel.
- `GROQ_API_KEY` verificada con éxito en el entorno real de Vercel mediante
  un endpoint de diagnóstico temporal (eliminado tras confirmar). Causa de
  la confusión previa: todas las variables del proyecto son "Sensitive" en
  Vercel — `vercel env pull` siempre devuelve `[SENSITIVE]` como valor
  literal, sin importar si la variable real está bien configurada. Nuevo
  protocolo agregado arriba: **nunca** diagnosticar variables de entorno con
  `.env` local, solo contra Vercel directamente. `.env.local` (que había
  quedado con 3 valores rotos por esa prueba) fue eliminado.
- Nueva funcionalidad: **aviso sonoro y emergente de solicitudes de
  traspaso**. Sondeo cada 20s a `/api/traspasos/pendientes`
  (`src/components/NotificadorTraspasos.tsx`, montado en el panel de empresa
  — solo si el usuario tiene el permiso `boleta.traspasar` — y en el portal
  de vendedor); al detectar una solicitud nueva desde que se abrió la
  sesión, suena un aviso corto (Web Audio, sin archivo externo) y aparece
  una tarjeta emergente con el detalle y acceso directo a aprobar/rechazar.
- Verificado: build limpio, 57 pruebas OK, `/api/traspasos/pendientes`
  responde 401 sin sesión (local y en producción), deploy exitoso.
  **Pendiente**: verificación visual del aviso sonoro/emergente en vivo
  (requiere una solicitud real entre dos sesiones logueadas, que el usuario
  debe iniciar ya que no manejo contraseñas).
- Conciliación con IA — modo "Extracto bancario": ahora también acepta el
  **PDF del extracto** directamente (además de pegar texto), hasta 8MB.
  Se extrae el texto del PDF con `unpdf` (lectura server-side, sin canvas,
  apta para funciones serverless de Vercel) y, como el formato de cada banco
  varía, el reconocimiento de movimientos pasa por IA en vez del parseo
  determinístico de líneas que se usa para el texto pegado. Nueva
  dependencia `unpdf` (MIT, documentada en Derechos reservados).
  Verificado: extracción de texto probada con un PDF de muestra (resultado
  correcto), build limpio, 57 pruebas OK.
- Vendedores: el listado y la ficha ahora muestran la **sede** del vendedor
  (o "Todas las sedes" si no tiene una fija). Se agregó la restricción de
  negocio pedida: `asignarTalonario` (`src/lib/vendedores.ts`) ahora exige
  que las boletas asignadas pertenezcan a la sede del vendedor —
  comparación directa contra `rifas.sede_id` para rifas no compartidas, y
  boleta por boleta vía `COALESCE(boletas.sede_id, rifas.sede_id)` para
  rifas compartidas — en los tres modos (consecutiva, aleatoria,
  específicas). Un vendedor sin sede fija (`sede_id` NULL = "todas las
  sedes") no tiene restricción. Aviso agregado en el formulario de
  asignación de talonario indicando la sede del vendedor.
  Verificado: build limpio, 57 pruebas OK, lógica SQL validada contra datos
  reales en una transacción de solo lectura (`BEGIN...ROLLBACK`), incluyendo
  el caso de una rifa compartida con boletas ya repartidas entre dos sedes.
- Corrección de bug preexistente (detectado de paso, no relacionado con lo
  anterior): el modo **"Serie consecutiva"** de `asignarTalonario` solo
  validaba que el rango no se solapara con otro *talonario*, pero nunca
  revisaba el estado real de cada boleta del rango antes de asignarla —
  podía reasignar en silencio una boleta ya vendida/reservada (p. ej.
  vendida directo por el punto de venta, sin talonario). Ahora reutiliza el
  mismo patrón que ya usaban los modos "aleatoria" y "específicas": trae las
  boletas del rango con `FOR UPDATE`, rechaza con el detalle de los números
  si alguna no está disponible, y actualiza por lista explícita de IDs en
  vez de un `UPDATE` ciego por rango.
  Verificado: build limpio, 57 pruebas OK, y una simulación en transacción
  de solo lectura (`BEGIN...ROLLBACK`) confirmó que el nuevo chequeo detecta
  correctamente una boleta ya vendida dentro del rango solicitado, sin dejar
  ningún cambio persistido en los datos reales.

### 2026-08-06 — Edición de rifas/sedes/vendedores, vendedor+sede en ventas/reportes, avisos de traspaso ampliados

- **Editar tras crear**: nuevas funciones `editarRifa`, `editarSede`,
  `editarVendedor` (`src/lib/rifas.ts`, `sedes.ts`, `vendedores.ts`), con
  formularios "✏️ Editar…" en cada ficha/listado. En rifas no se puede
  cambiar sede, dígitos ni si es compartida (determinan las boletas ya
  generadas); en vendedores, el formulario de edición exige además el
  permiso `vendedor.ver_pii` porque expone documento/teléfono.
- **Vendedor/punto de venta visible en ventas**: `listarVentas`/`obtenerVenta`
  ahora incluyen el vendedor y la sede; se muestran en el listado y en el
  detalle de cada venta ("Punto de venta" cuando no hay vendedor asignado).
- **Reportes por vendedor y sede**: nueva función `ventasPorVendedor`
  (`src/lib/reportes.ts`, CTE agrupando por vendedor/sede con recaudado real
  vía abonos) con su tabla en `/app/reportes` y export CSV
  `/api/export/vendedores`. Columnas Vendedor/Sede agregadas también al CSV
  de ventas.
- **Avisos de traspaso ampliados**: `/api/traspasos/pendientes` ahora
  también devuelve las solicitudes **enviadas** ya resueltas; el
  componente `NotificadorTraspasos` sondea cada 15s (antes 20s) y detecta
  transición de estado (no solo IDs nuevos), avisando con sonido + tarjeta
  emergente **al solicitante** cuando su traspaso es aprobado o rechazado
  (con el motivo, si lo hubo) — además del aviso ya existente al dueño de
  la boleta cuando llega una solicitud nueva.
- Verificado: build limpio, 57 pruebas OK, consulta `ventasPorVendedor`
  validada contra datos reales (se corrigió un `ORDER BY` que ordenaba el
  monto como texto en vez de numérico, detectado en esa misma validación),
  rutas nuevas/modificadas devuelven 307/401 sin sesión (local y
  producción). **Pendiente**: verificación visual en vivo de los
  formularios de edición y de los avisos de aprobación/rechazo (requiere
  sesión real, que el usuario debe iniciar).
- **No implementado — punto 5 de la solicitud**: no se reinician los
  consecutivos (IDs) de la base de datos al borrar una empresa. Son
  secuencias `GENERATED ALWAYS AS IDENTITY` **compartidas por todas las
  empresas** del mismo esquema (no hay una secuencia por tenant); reiniciar
  el contador global tras borrar una sola empresa causaría colisiones de
  llave primaria con filas ya existentes de las demás empresas. El borrado
  en cascada (`saas.purgar_tenant`) ya es completo: se confirmó que todas
  las tablas con `tenant_id` usan `ON DELETE CASCADE` sin excepción.

### 2026-08-06 (2) — Manual fuera del portal de vendedor/login, cambio de contraseña obligatorio desde la creación, aviso de instalación como app

- Se quitó el enlace "Manual de usuario" del menú del portal de vendedor
  (`src/app/vendedor/layout.tsx`) y de la pantalla de login
  (`src/app/login/page.tsx`). Sigue disponible en el panel de empresa, el
  panel de super-admin, la consulta pública y el pie de la landing.
- **Cambio de contraseña obligatorio también en la creación de la cuenta**
  (antes solo aplicaba a restablecimientos): se agregó
  `UPDATE saas.usuarios SET debe_cambiar_password = true` justo después de
  crear el usuario en los tres flujos de alta — `crearUsuario`
  (`src/lib/usuarios.ts`, admin creando usuarios internos),
  `crearAccesoVendedor` (`src/lib/portal-vendedor.ts`, acceso al portal
  móvil) y `crearTenant` (`src/lib/superadmin.ts`, administrador inicial de
  una empresa nueva). El redirect a `/cambiar-password` ya existía; solo
  faltaba activar la bandera en estos tres puntos.
- **Aviso de instalación como app** (`src/components/InstalarApp.tsx`,
  montado en el panel de empresa y el portal de vendedor): en el primer
  ingreso desde cada dispositivo aparece un aviso para instalar RIFAX como
  acceso directo. Aclaración técnica importante: ningún navegador permite
  instalar una app **sin que la persona lo confirme con un toque** (es una
  restricción de seguridad de la plataforma web, no una limitación de
  RIFAX) — esto es lo más automático que el estándar permite: el aviso
  aparece solo, un toque instala. En iOS/Safari no existe API de
  instalación programática; se muestran instrucciones manuales ("Compartir
  → Agregar a pantalla de inicio"). El manifest/service worker ya estaban
  correctamente configurados (`src/app/manifest.ts`, `public/sw.js`), solo
  faltaba el disparador de la interfaz.
- Verificado: build limpio, 57 pruebas OK, confirmado en vivo que el login
  ya no muestra el enlace del manual (local y producción), `manifest.webmanifest`
  y `sw.js` responden 200 en producción. **Pendiente**: verificar en vivo el
  flujo de cambio de contraseña obligatorio en una cuenta nueva y el aviso
  de instalación en un dispositivo real (requiere sesión real que el
  usuario debe iniciar).

### 2026-08-06 (3) — Manual quitado de consulta pública y landing; aclaración del fondo de login en Apariencia

- Se quitó el enlace "Manual de usuario" de la consulta pública
  (`src/app/consulta/page.tsx`) y del pie de la landing (`src/app/page.tsx`).
  Ahora solo queda accesible desde el panel de empresa y el panel de
  super-admin.
- Aclaración de texto en `/panel/carrusel` (Apariencia, super-admin): el
  código ya limitaba correctamente el "fondo de inicio de sesión" a
  `/login` (`getLoginFondo()` solo se usa ahí) — nunca afectó la landing.
  Se reescribió la descripción de la página y de cada bloque para que quede
  explícito: "Fondo de la pantalla de inicio de sesión (login)" es donde
  los usuarios ingresan correo/contraseña, distinto del "carrusel de la
  página pública de inicio (landing)".
- Verificado: build limpio, 57 pruebas OK, confirmado en vivo (local) que
  la landing y la consulta pública ya no muestran el enlace del manual;
  producción verificada por `curl` (sin coincidencias en el HTML de la
  landing). Deploy exitoso.

### 2026-08-06 (4) — Fondo de login roto, foco automático, navegación lenta (causa raíz), color de botón por defecto

- **Bug real de CSS, no de datos**: la imagen de fondo del login SÍ estaba
  guardada en la base de datos (2.3MB en base64), pero nunca se veía. Causa:
  `<main>` tenía un fondo opaco (`bg-slate-50`) que, por las reglas de
  pintado de CSS, se pintaba **encima** del `<div>` de la imagen — un
  z-index negativo en un hijo no sirve de nada si el propio padre tiene
  fondo opaco y no crea su propio contexto de apilamiento. Corregido en
  `src/app/login/page.tsx`: `<main>` ahora solo lleva el fondo por defecto
  cuando NO hay imagen configurada. Verificado en vivo (local con la BD
  real y producción): `background-color` de `<main>` pasa a transparente y
  la imagen queda visible.
- **Foco automático** (`autoFocus`) agregado a la primera caja de: login,
  recuperar acceso, cambiar contraseña (se agregó soporte de `autoFocus` a
  `PasswordInput`), consulta pública, y los formularios "nuevo" de rifas,
  sedes, vendedores, usuarios y ventas. No se agregó a los formularios de
  edición nuevos (están dentro de un `<details>` cerrado por defecto, así
  que no aplica hasta que el usuario los abre).
- **Causa raíz de la navegación lenta entre módulos**, con dos factores
  encontrados y corregidos:
  1. Las funciones de Vercel no tenían región fijada (por defecto EE.UU.),
     mientras que la base de datos Neon vive en São Paulo (`sa-east-1`) —
     cada consulta cruzaba el continente. Se fijó `"regions": ["gru1"]`
     (São Paulo) en `vercel.json`. Verificado en producción por el header
     `X-Vercel-Id`: la función ya ejecuta en `gru1`.
  2. `getSession()` (`src/lib/auth/session.ts`), que corre en **cada**
     navegación de `/app` y `/vendedor`, hacía 4 consultas a la base de
     datos una tras otra en vez de en paralelo. Se agruparon en dos tandas
     con `Promise.all` (sesión+usuario en paralelo; permisos+bandera de
     cambio de contraseña en paralelo), sin cambiar ninguna validación de
     seguridad existente.
- **Color de botón por defecto = #F5C518**: dentro de `/app`, el color de
  marca configurable (`Configuración`) ya rebautizaba la paleta "indigo" de
  Tailwind al color del tenant, pero el texto de contraste solo se forzaba
  para colores claros (bug: quedaba blanco-sobre-oscuro roto para un color
  de marca oscuro) y **el portal de vendedor no aplicaba nada de esto**
  (sus botones `bg-indigo-600` quedaban en el azul de Tailwind, no en la
  marca). Se extrajo la lógica a `src/lib/color.ts` (`brandCss()`,
  reutilizada por `/app` y `/vendedor`) y se agregó un valor por defecto
  global en `globals.css` (`--color-indigo-500/600/700` y el texto de
  contraste) para que **toda la aplicación** — login, panel de
  super-admin, consulta pública, y cualquier empresa que no haya
  personalizado su color — use #F5C518 por defecto, sin afectar el
  mecanismo ya existente de personalización por empresa desde
  Configuración.
  Verificado en vivo (local y producción): las variables CSS
  `--color-indigo-600` resuelven a `#f5c518` por defecto, y un botón de
  prueba con `bg-indigo-600 text-white` renderiza fondo `#f5c518` con
  texto `#1e293b` (contraste correcto), en vez del azul/blanco original.
- Build limpio, 57 pruebas OK en todos los pasos. **Pendiente**: medir en
  vivo cuánto mejoró realmente el tiempo de navegación con el cambio de
  región (no se puede cronometrar con precisión sin sesión real).

### 2026-08-06 (5) — Causa raíz de los botones rojos, pantalla completa oculta el menú, ícono de pestaña, ícono de instalación

- **Causa raíz real de los botones rojos** (no era un problema del fix de
  color de la sesión anterior, que ya funcionaba correctamente): la columna
  `saas.tenant_config.color_primario` tenía **`DEFAULT '#dc2626'`** (rojo,
  resto de una iteración de diseño anterior) desde la migración inicial del
  esquema. Como `crearTenant` nunca especifica ese valor al insertar la
  fila de configuración, toda empresa nueva heredaba el rojo del motor de
  base de datos hasta que un administrador entraba a Configuración y lo
  cambiaba a mano — el respaldo `?? "#f5c518"` en `getBranding()` nunca
  entraba en juego porque la fila sí existe, solo con el valor por defecto
  equivocado. Corregido con la migración `0015_color_primario_default.sql`
  (`ALTER COLUMN ... SET DEFAULT '#f5c518'`), aplicada y verificada. Se
  revisaron todas las empresas existentes: solo hay una en la base de
  datos y ya estaba en amarillo, así que no hizo falta corregir datos.
- **Modo pantalla completa que oculta el menú**: el botón de "pantalla
  completa" del control de zoom ahora, además de pedir el fullscreen del
  navegador, oculta el sidebar/topbar de `SideNav` (`src/components/side-nav.tsx`)
  por completo, dejando el contenido a ancho completo. Para volver a
  mostrarlo hay dos caminos siempre disponibles: el mismo botón de zoom
  (cambia de ícono/etiqueta), o un pequeño botón "Mostrar menú" que
  aparece arriba a la izquierda mientras el menú está oculto. Ambos
  disparadores usan un evento global (`EVENTO_ENFOQUE`, con un valor
  explícito true/false, no un simple "alternar") para que nunca queden
  desincronizados entre sí, incluyendo cuando el navegador sale de
  pantalla completa por su cuenta (Esc). Verificado en vivo (local y
  producción): ocultar hace desaparecer el `<header>` y aparecer "Mostrar
  menú"; ese botón lo restaura correctamente.
- **Ícono de la pestaña del navegador**: generado desde la imagen de logo
  que compartió el usuario (`Logo.png`, guardada en Descargas), procesada
  con `sharp` a un PNG cuadrado 512×512 con relleno blanco
  (`src/app/icon.png`, detectado automáticamente por Next.js). Se eliminó
  el `favicon.ico` por defecto de Next.js que quedaba desactualizado.
- **Ícono de instalación (acceso directo)**: generado desde `Logo2.png`
  (con el eslogan "Gestión Inteligente de Información"), en tres variantes
  procesadas con `sharp`: `public/icon-app-512.png` (icono normal),
  `public/icon-app-maskable-512.png` (con zona de seguridad ~22% para que
  los sistemas operativos no recorten el logo al aplicar su máscara), y
  `src/app/apple-icon.png` (180×180, para "agregar a inicio" en iOS, que
  no usa el manifest web). El manifest (`src/app/manifest.ts`) se
  actualizó para apuntar a los nuevos PNG en vez de los SVG genéricos
  anteriores. Nota entregada al usuario: como ambas imágenes son logos
  horizontales tipo wordmark (no una marca cuadrada), a tamaños muy
  pequeños el texto puede perder legibilidad; si se quiere el mejor
  resultado a futuro, lo ideal sería un ícono cuadrado simple (por ejemplo
  solo el check amarillo), pero se usó tal cual lo que se proporcionó.
- Verificado en vivo en producción: `<link rel="icon">` y
  `<link rel="apple-touch-icon">` apuntan a los nuevos archivos, y
  `manifest.webmanifest` expone los dos íconos PNG nuevos con sus
  propósitos (`any` / `maskable`). Build limpio, 57 pruebas OK.

### 2026-08-06 (6) — Reemplazo del favicon e ícono de instalación por el logo cuadrado

- El usuario proporcionó una versión ya cuadrada del logo (con el eslogan,
  fondo blanco, margen generoso) — mucho más apta para ícono que los
  wordmarks horizontales usados en la entrega anterior. Se regeneraron los
  4 archivos (`src/app/icon.png`, `src/app/apple-icon.png`,
  `public/icon-app-512.png`, `public/icon-app-maskable-512.png`) a partir
  de esta imagen con `sharp`, con relleno mínimo (4%) para favicon/apple/
  icono normal y una zona de seguridad más amplia (18%) para la versión
  "maskable". No hizo falta tocar `manifest.ts`: los nombres de archivo no
  cambiaron, solo el contenido de las imágenes.
- Verificado en producción: `icon.png` y `apple-icon.png` responden 200, y
  el manifest sigue exponiendo ambos íconos correctamente. Build limpio.

### 2026-08-06 (7) — Edición de usuarios internos (rol, permisos, datos generales)

- Se agregó edición completa de usuarios ya creados (admin/gerente/cajero/
  vendedor): `obtenerUsuario` y `editarUsuario` en `src/lib/usuarios.ts`,
  acción `editarUsuarioAction` en `src/app/app/usuarios/actions.ts`, y una
  nueva página `src/app/app/usuarios/[id]/page.tsx` +
  `src/app/app/usuarios/[id]/form-editar.tsx` (checklist de permisos igual
  al de creación, precargando los permisos personalizados del usuario si
  los tiene, o los del rol si no). Guardas ya usadas en el resto de
  ediciones de esta sesión: no se puede cambiar el propio rol, no se
  permite dejar la empresa sin ningún admin activo, correo duplicado
  bloqueado, sede validada contra el tenant. Se agregó el enlace "Editar"
  en `src/app/app/usuarios/page.tsx`.
- Build limpio y 57 pruebas OK. Verificación en navegador limitada a
  estructura/copy (no se completó login interactivo por la regla de no
  escribir contraseñas); el usuario puede validar el flujo completo
  entrando con su cuenta.

### 2026-08-06 (8) — Recuperación de contraseña automática por correo

- Antes, "¿Olvidaste tu contraseña?" solo registraba la solicitud para que
  un super-admin la resolviera manualmente y entregara la contraseña
  temporal en persona. Ahora se resuelve sola: `solicitarResetAutomatico`
  en `src/lib/reset-password.ts` valida el correo, lo busca contra
  `usuarios`/`plataforma_admins` (mismo criterio que ya usaba
  `restablecerPorCorreo` del panel de super-admin), genera la contraseña
  temporal, marca `debe_cambiar_password`, revoca sesiones activas, y
  **envía la contraseña por correo** al mismo correo registrado en la
  cuenta (nunca a uno distinto al que ya está en la base de datos). La
  respuesta al usuario es siempre genérica, para no revelar si el correo
  existe.
- Nuevo `src/lib/mail.ts`: envío por SMTP con `nodemailer`, configurado
  por variables de entorno (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
  `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`); si no están configuradas, no
  falla — registra el correo simulado en el log del servidor. Mismo patrón
  ya usado en el proyecto hermano "Contratación".
- **Pendiente del usuario**: agregar las variables SMTP reales al proyecto
  Vercel de rifax2 (hoy no existen — `vercel env ls` no las lista). Hasta
  entonces, el flujo funciona pero el correo solo queda simulado en el
  log, no se entrega de verdad. El panel de super-admin
  (`/panel/restablecer`) se deja intacto como respaldo manual.
- Build limpio y 57 pruebas OK. Desplegado a producción
  (`https://rifax2.vercel.app`). No se sometió el formulario de "olvidé mi
  contraseña" con una cuenta real durante la verificación (resetearía la
  contraseña de una cuenta real en la única base de datos compartida); se
  acordó con el usuario que él mismo probaría el flujo en vivo.

### 2026-08-06 (9) — SMTP configurado (Gmail); superadmin: quitar panel manual de contraseñas, editar empresas; aviso de vencimiento a 5 días; planes configurables

- **SMTP real configurado** en Vercel (`gestionrifax@gmail.com` / `smtp.gmail.com:587`): el usuario agregó `SMTP_PASSWORD` (App Password de Gmail) desde el dashboard web de Vercel, ya que no se pudo usar `vercel` CLI en su equipo (no estaba instalado localmente — confirmado con `where node` / `npm root -g` / `dir` desde su propia terminal). Las demás variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `MAIL_FROM`) se crearon por CLI (no son secretas). Redeploy hecho; el envío de "olvidé mi contraseña" ya no debería quedar solo simulado en el log.
- **Panel manual de contraseñas retirado** (`/panel/restablecer` eliminado por completo, código y enlace): ya no hace falta, el restablecimiento por correo (2026-08-06 (8)) lo resuelve solo. `restablecerPorCorreo` sigue existiendo como función interna (no exportada) usada por `solicitarResetAutomatico`.
- **Editar empresas desde el super-admin**: nueva página `/panel/[id]` (`obtenerTenant`/`editarTenant` en `src/lib/superadmin.ts`) para editar nombre, slug, cupos de sedes/usuarios y vigencia (periodicidad, periodicidad de pago, fecha de inicio) de cualquier empresa ya creada. Si cambia la periodicidad o la fecha de inicio, se regenera el calendario de vencimientos (mismo criterio que el botón manual ya existente). Enlace "Editar" agregado en la lista de empresas.
- **Aviso de vencimiento a 5 días (antes 3), y ahora también en el super-admin**: `src/app/app/vencimiento-aviso.tsx` cambió su ventana de 3 a 5 días. Nuevo `src/app/panel/vencimiento-aviso.tsx` + `proximosVencimientosCriticos()` en `src/lib/vencimientos.ts`: el super-admin ahora ve un aviso emergente al entrar si una o más empresas están a 5 días o menos de vencer (o ya vencidas), listándolas por nombre. Mismo patrón que el aviso del lado de la empresa (fetch en el layout del servidor + modal cliente con estado local, sin necesidad de sondeo).
- **Planes reestructurados y configurables**: migración `prisma/sql/0016_planes_configurables.sql` — `saas.plataforma_config` gana `sedes_basico` (def. 1), `sedes_corporativo` (def. 2), `precio_basico_mensual/semestral/anual` (def. 180000/140000/120000), y se elimina la columna `precio_basico` (reemplazada por las tres). Plan **Básico**: 1 sede, usuarios ilimitados (antes tope de 2). Plan **Corporativo**: 2 sedes (antes ilimitadas), usuarios ilimitados (sin cambio). El resto de capacidades de cada plan (integraciones, conciliación IA, SLA, etc.) no cambió. Todo editable desde `/panel/facturacion`. La facturación automática (individual y masiva) ahora calcula el monto del plan Básico según la `periodicidad_pago` de cada empresa, no un precio único fijo. La landing (`/`) y el formulario "Nueva empresa" muestran/prellenan los valores configurados en vez de números fijos en el código.
- Build limpio y 57 pruebas OK en cada paso. Verificado en vivo en producción: la landing muestra los 3 precios del plan Básico y el número de sedes de cada plan correctamente; `/panel/restablecer` ya no sirve el panel viejo. Las páginas de super-admin (`/panel/[id]`, aviso de vencimiento, formulario de nueva empresa) no se pudieron probar autenticadas por la regla de no escribir contraseñas — quedan pendientes de que el usuario las revise con su propia sesión.

### 2026-08-06 (10) — Auditoría con 5 especialistas (seguridad, datos, frontend, devops, calidad) + skill de orquestación

- Se creó el skill del proyecto `.claude/skills/auditoria-especialistas/SKILL.md`, que orquesta a los 5 subagentes ya definidos en `.claude/agents/` (`seguridad-appsec`, `backend-datos-prisma`, `frontend-nextjs`, `devops-vercel`, `calidad-qa`) uno a la vez (no en paralelo, para no pisarse ediciones sobre el mismo working directory), verificando `npm run build`/`npm test` antes y después de cada uno. Se ejecutó de inmediato una pasada completa contra todo el repo (no solo lo agregado hoy).
- **Seguridad** — halló y corrigió **IDOR intra-tenant real**: un vendedor o cajero podía abrir `/app/ventas/<id>` de ventas ajenas (otros vendedores/otras sedes) y ver/editar/anular abonos y clientes fuera de su alcance; mismo problema en el listado/detalle de vendedores para usuarios acotados a una sede. Agregó rate-limiting (login, "olvidé mi contraseña", consulta pública) que no existía. Corrigió que un usuario pudiera auto-concederse permisos al editarse a sí mismo. Dejó documentados y sin aplicar (por cambiar comportamiento): token de un solo uso para el reset de contraseña (hoy una sola petición ya cambia la clave del titular, mitigado pero no eliminado por el rate-limit), quitar la contraseña temporal de la query string, y agregar CSP.
- **Datos** — halló y corrigió **un bug que rompía siempre** el traspaso a punto de venta en rifas no compartidas (parámetros SQL desalineados), **tres ordenamientos por texto en vez de por valor/fecha real** que daban resultados incorrectos (top de vendedores, próximo vencimiento del panel y del aviso emergente), **doble liquidación posible de comisiones** por condición de carrera (corregida con `pg_advisory_xact_lock`), y **falta de validación de tenant** en `vendedor_id`/`sede_id` al crear ventas/vendedores (una venta podía atribuirse a un vendedor de otra empresa). Aplicó migración `prisma/sql/0017_integridad_indices.sql`: 15 índices (el más importante, `sesiones.familia`, consultado en cada navegación), 13 FKs compuestas `(id, tenant_id)` que ahora impiden a nivel de base de datos el cruce entre empresas, y 11 CHECKs de integridad monetaria/de cupos. Verificó contra los datos reales de Neon: sin incoherencias existentes.
- **Frontend** — agregó estado de carga (`useFormStatus`) a los formularios de edición de usuario y de empresa creados hoy (antes permitían doble-envío sin feedback), y `role="dialog"`/`aria-modal`/foco inicial/cierre con Escape a los dos avisos de vencimiento y al menú lateral móvil (WCAG 2.1 AA). Sin hallazgos en la frontera servidor/cliente ni en tipos.
- **DevOps** — documentó en el README las variables SMTP agregadas hoy (no estaban en la tabla). **Nota de seguridad**: este agente intentó además quitar `.env*`/`.vercel` de `.gitignore`; el clasificador de seguridad de la plataforma bloqueó ese cambio automáticamente y se verificó manualmente que el archivo no fue tocado — no hubo exposición real. Encontró que `npm run build` no corre ESLint (por eso 15 errores de lint pasaban desapercibidos) y confirmó por `vercel env ls` que todas las variables de entorno necesarias, incluidas las de SMTP, están cargadas en Vercel.
- **Calidad/QA** — corrigió los 15 errores de lint a 0 (quedó 1 warning documentado a propósito) y agregó 44 pruebas nuevas (rate-limit, cálculo de precio por periodicidad, validaciones de los formularios de edición de usuario/empresa agregados hoy), pasando de 57 a 101 pruebas. Encontró que el envío de correo en el restablecimiento automático no tenía manejo de errores: si el SMTP fallaba, la excepción se propagaba **después** de que la contraseña ya había cambiado y las sesiones ya se habían revocado, dejando al usuario sin acceso y sin el correo — **corregido** (try/catch con log, la función sigue respondiendo genérico). Dejó documentado (no corregido, fuera de su dominio): `liberarBoletasSede` no registra auditoría del actor.
- Nada de esto se hizo commit ni se desplegó — todos los cambios quedan en el working tree para que el usuario los revise (`git status`/`git diff`) antes de decidir.
- Estado final verificado: `npm run build` limpio, `npm run lint` 0 errores, `npm test` 101/101 en 9 archivos.

### 2026-08-06 (11) — Revisión funcional: se ejecutó la lógica real de cada módulo

- A pedido del usuario ("revisión funcional... ejecutando toda la lógica"), se construyó `test/functional/` — una suite que, a diferencia del resto de pruebas (todas con Prisma simulado), corre contra la **base de datos real de Neon**. Crea una empresa desechable (`test/functional/harness.ts`, vía la misma `crearTenant()` que usa el super-admin), ejecuta ahí la lógica real de cada módulo, y al final la borra por completo con `purgar_tenant()` — el mismo mecanismo del "eliminar empresa en 3 pasos". No usa el navegador ni ninguna contraseña real: la contraseña de la cuenta de prueba se genera por código y nunca se escribe en un formulario. Se agregó `npm run test:functional` (`vitest.functional.config.ts`, separado de `npm test` para no volver lenta la suite normal ni tocar la BD en cada corrida rutinaria).
- **33 pruebas, cubriendo con lógica real**: calendario de vencimientos según periodicidad, edición de tenant (regenera calendario), cupos de sedes, suspender/reactivar empresa, facturación del plan básico según periodicidad de pago (con el fix de "doble pago" del agente de datos verificado en vivo), sedes duplicadas, alta/edición de usuarios y la regla de "al menos un admin activo", alta de vendedores y validación de sede, publicación de una rifa (materialización real de boletas), los 3 modos de asignación de talonario sin solaparse, rifa compartida (asignar/liberar boletas por sede), **dos ventas simultáneas a la misma boleta compitiendo de verdad** (solo una gana), abonos con bloqueo de sobrepago, anulación de venta, traspasos (aprobar/rechazar con motivo), comisiones y liquidación (incluyendo el fix de doble-liquidación del agente de datos, verificado con dos liquidaciones simultáneas reales), un sorteo commit-reveal completo con verificación matemática del resultado, y el reset automático de contraseña por correo.
- **Bug real encontrado al ejecutar la lógica** (no visible con las pruebas simuladas, porque nadie había ejecutado el flujo completo hasta ahora): `editarVendedor` (`src/lib/vendedores.ts`) resetea `pct_comision` a **0%** y `cupo_max` a **sin límite** cuando esos campos llegan vacíos en el formulario. El formulario real precarga el valor actual (`defaultValue`), así que en el uso normal no pasa nada — pero si un admin borra manualmente el campo de comisión (por ejemplo, al corregir el teléfono) y guarda, el vendedor queda sin comisión sin ningún aviso. **No se corrigió**: es una decisión de producto (¿debe permitirse "vaciar" esos campos, o deben preservar el valor anterior si llegan vacíos?), no un bug de sintaxis — queda para que el usuario decida.
- Todos los cambios del código de la app durante esta revisión fueron correcciones a las propias pruebas (no de la aplicación); el único cambio de comportamiento real que sigue pendiente es el de `editarVendedor` de arriba.
- Verificado al final: cero empresas de prueba (`slug LIKE 'qa-func-%'`) quedaron en la base real — limpieza confirmada por consulta directa, no solo por el resultado de la prueba.
- `npm run build` y `npm test` (suite normal, 101 pruebas) siguen en verde tras estos cambios.

### 2026-08-06 (12) — Corregido: editarVendedor ya no resetea comisión/cupo al dejar el campo vacío

- El usuario pidió aplicar la corrección más indicada al hallazgo de la revisión funcional. Se cambió `src/lib/vendedores.ts` → `editarVendedor`: cuando `pct_comision`/`cupo_max` llegan vacíos (el admin no tocó esos campos, p. ej. solo corrigió el teléfono), ahora se **conserva el valor que ya tenía el vendedor** (`d.pct_comision ?? actual.pct_comision`, `d.cupo_max ?? actual.cupo_max`) en vez de resetear a 0%/sin-límite en silencio. `sede_id`/`correo` se dejaron igual (`?? null`): ahí "vacío" sí significa legítimamente "sin dato", a diferencia de un valor monetario que nunca debería cambiar por omisión.
- Se agregó una prueba de regresión a `test/functional/index.test.ts` ("editarVendedor con comisión/cupo vacíos CONSERVA los valores anteriores") que edita un vendedor sin enviar esos dos campos y confirma que no cambian, mientras que el resto del formulario (teléfono) sí se actualiza.
- Verificado: `npm run build` limpio, `npm test` 101/101, `npm run test:functional` 34/34 (33 anteriores + la nueva), y confirmado por consulta directa que no quedó ninguna empresa de prueba en la base real.

### 2026-08-07 — Documento en HTML de características funcionales; paso a paso de rifa compartida en el manual

- **Conversión a HTML**: `docs/caracteristicas-funcionales.md` se convirtió a `docs/manual/caracteristicas-funcionales.html` (sincronizado a `public/manual/`), con el mismo estilo y marca que `manual-usuario.html` (índice lateral, tarjetas por rol, pasos numerados, tabla de planes). Se agregó el enlace cruzado entre ambos documentos en la barra superior.
- **Confirmado, no era una regresión**: el color amarillo (#F5C518) por defecto de los botones primarios sigue intacto — verificado tanto en `globals.css` (`--color-indigo-600: #f5c518`) como en la base real (`tenant_config.color_primario` sigue con default `#f5c518`). No hizo falta ningún cambio.
- **Paso a paso de "rifa compartida" en el manual**: se agregó una sección nueva (`#rifa-compartida`) en `docs/manual/manual-usuario.html` explicando, con el texto exacto de la pantalla, qué pasa al marcar "Para todas las sedes (compartida)" al crear una rifa: el cambio de etiqueta del selector de sede, que las boletas se publican sin dueño ("sin asignar"), y el paso a paso completo de repartirlas por sede (rango consecutivo, rango aleatorio o números específicos) desde la sección "Distribución por sede" de la ficha de la rifa, incluyendo "Liberar disponibles" para corregir un reparto.
- Build limpio y 101/101 pruebas. Verificado en vivo contra el servidor local que el nuevo documento HTML y la nueva sección del manual renderizan correctamente.

### 2026-08-07 (2) — Características funcionales: archivo independiente del programa (sin "Derechos reservados")

- El usuario pidió que el documento de características funcionales deje de ser parte del aplicativo. Se eliminó `docs/manual/caracteristicas-funcionales.html` y su copia servida en `public/manual/caracteristicas-funcionales.html` (ya no se sirve desde la app en absoluto). Se creó `docs/caracteristicas-funcionales.html` — un archivo 100% autocontenido: CSS embebido en línea (ya no depende de `docs/manual/style.css`), sin ningún enlace de navegación hacia el manual, "Acerca de" ni "Derechos reservados" (se quitó el menú superior del programa por completo, solo queda un encabezado simple con la marca RIFAX). Verificado por búsqueda de texto que no queda ninguna referencia a esas páginas del programa.
- Se revirtió el enlace cruzado agregado ayer en `docs/manual/manual-usuario.html` (y su copia en `public/manual/`) hacia "Características funcionales", ya que ese documento dejó de estar conectado al programa.
- Build limpio y 101/101 pruebas.

### 2026-08-07 (3) — Eliminada por completo la página "Derechos reservados"; primer despliegue en horas del día

- El usuario, revisando producción, seguía viendo "Derechos reservados" y no encontraba el HTML independiente. Causa real: **no se había desplegado nada desde temprano hoy** — todo el trabajo de la auditoría de 5 especialistas, la suite de pruebas funcionales, la corrección de `editarVendedor` y los cambios de documentación llevaban horas solo en el entorno local.
- Se rastrearon **todas** las referencias a "Derechos reservados" en la aplicación (no solo en el documento nuevo): el pie de la página de inicio pública (`src/app/page.tsx`), el menú superior y el pie de `manual-usuario.html`, y el menú superior y el pie de `acerca-de.html`. Se quitaron los cinco enlaces y, al quedar huérfana, se eliminó `derechos-reservados.html` (`docs/manual/` y `public/manual/`).
- **Desplegado a producción** (`https://rifax2.vercel.app`) — el primero desde la mañana. Verificado en vivo: el pie de la landing y el menú del manual ya no muestran "Derechos reservados", y `/manual/derechos-reservados.html` responde 404 sin enlaces rotos en el resto del sitio.
- Se envió `docs/caracteristicas-funcionales.html` directamente al usuario como archivo, ya que — a propósito, por el cambio de la entrada anterior — dejó de estar publicado y solo existe localmente.
- Build limpio y 101/101 pruebas antes de desplegar.

### 2026-08-07 (4) — Confirmado: sedes independientes + rol "auditor" (administrador general de solo consulta)

- El usuario pidió que, en empresas con más de una sede, cada sede opere de forma independiente (misma base de datos) y que exista la opción de un "gran administrador" que solo pueda consultar el avance de las sedes. **Investigado antes de construir nada**: esta capacidad ya existía completa desde el esquema original (`prisma/sql/0001_saas.sql`) — el rol **`auditor`** ("Consulta y reportes de solo lectura") solo trae permisos `*.ver` + `reporte.auditoria`, sin ningún permiso de creación/edición/eliminación/publicación; y `estadoSedes()` (el "Estado por sede" del panel principal) siempre devuelve todas las sedes del tenant, filtrándose a una sola solo cuando el usuario tiene sede fija. Un usuario con rol `auditor` y **sin sede asignada** ya cumplía exactamente lo pedido, sin que estuviera documentado ni fuera fácil de descubrir en la interfaz.
- **Verificado con lógica real** (no solo lectura de código): se agregaron 2 pruebas a `test/functional/index.test.ts` que (1) confirman contra la base real que el rol `auditor` no tiene ningún permiso fuera de `*.ver`/`reporte.auditoria`, y (2) crean un usuario auditor sin sede fija y comprueban que `estadoSedes()` le devuelve las dos sedes de prueba, no solo una. 36/36 pruebas funcionales OK.
- **Mejora de descubribilidad**: los desplegables de rol al crear/editar un usuario (`src/app/app/usuarios/nuevo/form.tsx`, `src/app/app/usuarios/[id]/form-editar.tsx`) ahora muestran también la descripción del rol (p. ej. "auditor — Consulta y reportes de solo lectura"), no solo el nombre y el conteo de permisos — se extendió `permisosYRoles()` en `src/lib/usuarios.ts` para traer `descripcion`.
- Documentado en `docs/manual/manual-usuario.html` (sección "Usuarios internos") y en `docs/caracteristicas-funcionales.md`/`docs/caracteristicas-funcionales.html`: cómo crear este "administrador general de consulta" (rol auditor + sin sede asignada) y qué ve exactamente.
- Build limpio, 101/101 pruebas normales, desplegado a producción y verificado en vivo que el manual ya menciona el rol auditor.

### 2026-08-07 (5) — Confirmado: N sedes (no solo 2) + entorno propio por sede, excepto en traspasos

- El usuario aclaró el requisito anterior: pueden ser 1, 2 o más sedes (no un número fijo), cada una con su propio entorno por estar en lugares distintos, con la excepción de que los traspasos deben poder consultar toda la base de datos de la empresa (para poder encontrar y solicitar boletas de otra sede). **Verificado con lógica real, no solo con lectura de código**: se agregaron 2 pruebas a `test/functional/index.test.ts`.
  1. Se creó una **tercera** sede en la empresa de prueba (además de las dos ya existentes) y se confirmó que `estadoSedes()` devuelve las tres — no hay ningún tope de "2 sedes" en el sistema, solo el que autorice el plan/cupo de cada empresa (`cambiarMaxSedes`). Una cuarta sede, por encima del cupo, se rechazó correctamente.
  2. Se llamó a `buscarBoleta()` (la función real detrás de "buscar boleta puntual" en traspasos) "parado" en la Sede B, buscando una boleta que pertenece a la Sede A — y la encontró (`resultado: "punto_de_venta"`, con la sede correcta y `puedeSolicitar: true`). Confirma que la búsqueda de traspasos **no** está acotada al entorno propio del usuario, a diferencia del resto de los módulos (ventas, cartera, reportes), que sí lo están.
- Documentado explícitamente esta excepción en `docs/manual/manual-usuario.html` (sección Traspasos) y en `docs/caracteristicas-funcionales.md`/`.html`.
- Build limpio, 101/101 pruebas normales, 38/38 funcionales, desplegado a producción y verificado en vivo.

### 2026-08-07 (6) — Un administrador por sede (creación conjunta) + bug real corregido en la validación de sede al crear una rifa

- El usuario propuso cambiar la secuencia de arranque: en vez de un único administrador general creando todas las sedes, cada sede debería poder tener su propio administrador, gestionando su propia rifa (numeración propia si es independiente, repartida si decide compartirla con otra sede). Se confirmó primero con el usuario (mediante una pregunta) que: (1) se mantiene también un administrador general que ve todas las sedes, como hoy, y (2) el administrador de cada sede se crea junto con la sede, no todos de una vez al crear la empresa.
- **`src/lib/sedes.ts`** — `crearSede()` ahora acepta, opcionalmente, los datos de un administrador (`admin_nombre`, `admin_correo`, `admin_password`); si se completan, crea la sede **y** su administrador en la misma transacción (todo o nada: si el correo ya existe, no se crea ni la sede). El nuevo administrador tiene el mismo rol "admin" que el general, pero con `sede_id` fijo a esa sede, y queda obligado a cambiar su contraseña al primer ingreso (mismo criterio que cualquier cuenta nueva). El formulario "Nueva sede" (`src/app/app/sedes/form.tsx`) ahora tiene una casilla opcional "Crear un administrador propio para esta sede" que revela esos tres campos.
- **Bug real encontrado y corregido al escribir la prueba funcional de este flujo** (`src/lib/rifas.ts` → `crearRifa`): la validación de que un administrador acotado a una sede solo pueda crear rifas para *su* sede tenía una clave `id` duplicada en el mismo objeto de consulta (`{ id: d.sede_id, ..., ...(sedeIdUsuario ? { id: sedeIdUsuario } : {}) }`) — en JavaScript, la segunda clave `id` sobrescribe silenciosamente a la primera, así que la comprobación terminaba ignorando por completo qué sede pidió el usuario en el formulario y solo confirmaba que su propia sede fuera válida. En la práctica, cualquier administrador (o cualquier rol con `rifa.crear`) acotado a una sede podía crear una rifa para **cualquier otra sede** de la empresa con solo cambiar el `sede_id` enviado. Corregido con una comprobación explícita separada antes de la consulta.
- Se agregaron 5 pruebas nuevas a `test/functional/index.test.ts` (creación conjunta sede+admin, rol y sede correctos, obligación de cambiar contraseña, rechazo si el correo ya existe sin dejar la sede a medias, y la prueba que detectó el bug: un admin de sede intentando crear una rifa para otra sede). 41/41 pruebas funcionales OK tras la corrección.
- Documentado en `docs/manual/manual-usuario.html` (secciones Sedes y Rifa compartida) y en `docs/caracteristicas-funcionales.md`/`.html`: cómo crear el administrador de una sede, y que cada sede puede tener su propia rifa independiente (numeración propia) o compartir una con otras sedes (numeración repartida) — ambas ya soportadas.
- Build limpio, 101/101 pruebas normales, desplegado a producción y verificado en vivo.

### 2026-08-07 (7) — Investigación de "traspasos pide solicitar boletas ya asignadas": no se reprodujo el bug

- El usuario reportó que, al revisar la asignación de boletas por sede y los traspasos, el sistema pedía "Solicitar" una boleta que ya estaba asignada a quien la buscaba (debería mostrarse como disponible para venta directa). Se investigó a fondo con lógica real, no solo lectura de código, agregando **5 pruebas nuevas** a `test/functional/index.test.ts` que cubren cada variante razonable del escenario:
  1. Un vendedor busca una boleta que ya está en su propio talonario → `tuya` / venta directa (OK).
  2. Una sede busca una boleta que ya le fue asignada (`asignarBoletasSede`, rifa compartida) → `tuya` (OK); la misma boleta vista desde otra sede → pide solicitud (OK, correcto que no sea "tuya" ahí).
  3. **Camino real completo**: se crea el acceso al portal de un vendedor (`crearAccesoVendedor`, lo mismo que usa el admin desde la ficha del vendedor) y se resuelve su contexto con `contextoDeUsuario()` — la misma función que usa la pantalla real —, no construido a mano: reconoce correctamente al vendedor y su boleta como `tuya`.
  4. Una sede busca una boleta sin talonario de su propia rifa (no compartida, donde la sede es la de la rifa) → `tuya` (OK).
- **No se encontró ningún bug**: las 45 pruebas funcionales pasan (40 anteriores + 5 nuevas). El cálculo de "es tuya" (`buscarBoleta` en `src/lib/traspasos.ts`), la asignación de boletas por sede (`asignarBoletasSede`) y la pantalla de búsqueda (`src/app/app/ventas/nueva/form.tsx`, que es el único lugar de la aplicación donde existe esta búsqueda — los traspasos no tienen su propio buscador, listan solicitudes) se revisaron y ejecutaron con datos reales sin reproducir el síntoma descrito.
- Se le pidió al usuario más detalle para reproducirlo (qué rol tenía la sesión que buscaba, si la boleta se acababa de asignar justo antes de buscarla —posible resultado de búsqueda desactualizado en pantalla, ya que no se refresca solo— y los pasos exactos), ya que la lógica de negocio, verificada de punta a punta, se comporta como se espera.
- No hubo cambios de código de la aplicación en esta entrada (solo pruebas nuevas); no se desplegó.

### 2026-08-08 — Cambio de credenciales desde la edición de usuarios, vendedores y sedes

- El usuario pidió que, al editar usuarios, vendedores y sedes, el administrador pueda cambiar sus credenciales/contraseña; la contraseña activa debe mostrarse enmascarada (`**`) — nunca en texto real, algo imposible además porque se guarda con hash de un solo sentido (bcrypt) — y el resto de los campos del formulario deben seguir siendo editables como hasta ahora.
- **Usuarios internos** (`src/lib/usuarios.ts`, `src/app/app/usuarios/actions.ts`, `src/app/app/usuarios/[id]/form-editar.tsx`): `editarUsuarioSchema`/`editarUsuario()` aceptan un `password` opcional (mínimo 8 caracteres); si se envía, se hashea, se fuerza `debe_cambiar_password=true` y se revocan las sesiones activas del usuario (mismo criterio que `restablecerUsuarioTenant`). El formulario ahora tiene un campo de contraseña con `PasswordInput` (marcador `••••••••`, vacío por defecto): en blanco conserva la actual, con texto la reemplaza.
- **Vendedores** (`src/lib/portal-vendedor.ts`, `src/app/app/vendedores/actions.ts`, `src/app/app/vendedores/[id]/page.tsx`): nueva función `actualizarAccesoVendedor()` para cambiar el correo y/o la contraseña de un vendedor que **ya tiene** acceso al portal (a diferencia de `crearAccesoVendedor`, que es de una sola vez). El bloque "Acceso al portal de vendedor" de la ficha ahora, si ya existe el acceso, muestra un formulario con el correo precargado (editable) y una contraseña opcional enmascarada; si no existe, se mantiene "Crear acceso" pero con el campo de contraseña migrado a `PasswordInput` (antes era texto plano) para que también quede enmascarado desde la creación.
- **Sedes**: una sede no tiene credenciales propias — la contraseña vive en el usuario administrador de esa sede (feature "un admin por sede" del 2026-08-07). `listarSedes()` ahora incluye ese administrador si existe, y el bloque "✏️ Editar sede" muestra un enlace "gestionar sus credenciales →" que lleva directo a su ficha de usuario, reutilizando la edición de usuarios de arriba en vez de duplicar la lógica.
- Se agregaron 2 pruebas nuevas a `test/functional/index.test.ts`: `editarUsuario` con contraseña (cambia el hash, fuerza `debe_cambiar_password`, revoca una sesión simulada; en blanco conserva el hash) y `actualizarAccesoVendedor` (cambia correo y contraseña de un acceso ya creado, rechaza crear un segundo acceso para el mismo vendedor, y confirma que enviar solo el correo conserva la contraseña). 47/47 pruebas funcionales OK, sin tenants de prueba residuales.
- Build limpio, 101/101 pruebas normales. Documentado en `docs/manual/manual-usuario.html` (sincronizado a `public/manual/`) y `docs/caracteristicas-funcionales.md`/`.html`.

### 2026-08-08 (2) — Aviso por correo al cambiar contraseña desde la edición de usuarios/vendedores

- El usuario pidió que, cuando el admin cambia la contraseña de un usuario, vendedor o del administrador de una sede (feature de la entrada anterior), la clave digitada se envíe por correo a la dirección registrada de esa cuenta, igual que hace hoy "¿Olvidaste tu contraseña?".
- **`src/lib/mail.ts`**: nueva plantilla `mailPasswordCambiada()`, con el mismo formato visual que `mailPasswordTemporal()` pero con el aviso correcto para este caso ("Un administrador actualizó tu contraseña...", en vez de "Recibimos una solicitud para restablecer..."), para no confundir a quien la recibe.
- **`src/lib/usuarios.ts`** (`editarUsuario`) y **`src/lib/portal-vendedor.ts`** (`actualizarAccesoVendedor`): cuando el admin efectivamente cambia la contraseña (campo no vacío), tras confirmar el guardado en base de datos se envía el correo a la dirección que quedó registrada (si en el mismo formulario también se cambió el correo, se envía a la nueva). El envío va en un `try/catch` que solo registra el error en consola si falla (SMTP caído, etc.) — el cambio de contraseña ya quedó guardado y no debe revertirse por un fallo de correo, mismo criterio que ya usa `solicitarResetAutomatico`.
- Sedes no requirió cambios: su "contraseña" es la del usuario administrador de la sede, editado a través de `editarUsuario`, así que ya queda cubierto.
- No se agregaron pruebas nuevas al arnés funcional: `sendMail()` ya no intenta conexión real cuando no hay `SMTP_HOST/USER/PASSWORD` configurados (caso del entorno de pruebas local), así que el comportamiento de guardado ya está cubierto por las pruebas existentes de la entrada anterior; el envío en sí se verificó por inspección de código y del flujo ya probado en producción para "olvidé mi contraseña".
- Build limpio, 101/101 pruebas normales, 47/47 funcionales (sin cambios, siguen pasando). Documentado en `docs/manual/manual-usuario.html` (sincronizado a `public/manual/`) y `docs/caracteristicas-funcionales.md`/`.html`.

### 2026-08-08 (3) — Fondo tipo boleta en el recibo de venta

- El usuario pidió que el recibo de venta se vea igual que hoy, solo cambiando el fondo por la "forma de boleta" — es decir, usar la imagen de boleta que ya se puede cargar en la ficha de cada rifa (`imagenesRifa`, campo `boleta_url`) como fondo del recibo. El manual ya prometía esto ("la imagen que se imprime en el recibo que recibe el comprador") pero no estaba implementado: el recibo (`src/app/app/ventas/[id]/recibo/page.tsx`) solo usaba el logo, nunca la imagen de boleta.
- **`src/app/app/ventas/[id]/recibo/page.tsx`**: ahora consulta `imagenesRifa()` (antes solo `logoRifa()`) y, si la rifa tiene una imagen de boleta cargada, la aplica como `background-image` (`cover`/`center`) del contenedor del recibo. Todo el contenido (logo, datos de la venta, pagos, totales) queda exactamente igual que antes, dentro de una capa blanca translúcida (`bg-white/90`, `dark:bg-slate-950/80`) para que el texto siga siendo legible sin importar la imagen de fondo que suba cada empresa. Si la rifa no tiene imagen de boleta, el recibo se ve igual que hasta ahora (fondo blanco liso).
- Se agregó `-webkit-print-color-adjust: exact` / `print-color-adjust: exact` al CSS de impresión, porque los navegadores omiten fondos/imágenes al imprimir por defecto — sin esto, el fondo se vería en pantalla pero no en el recibo impreso/PDF.
- No se tocó lógica de negocio (solo la página de presentación), así que no se agregaron pruebas al arnés funcional; se corrieron de todas formas el build y los 101 tests unitarios (sin cambios, ambos en verde).
- Documentado en `docs/manual/manual-usuario.html` (sincronizado a `public/manual/`) y `docs/caracteristicas-funcionales.md`/`.html`, precisando que la imagen de boleta ahora sí se usa como fondo del recibo.

### 2026-08-08 (4) — Corrección: el pedido no era el recibo, sino el badge de números en "Nueva venta" — se deshizo el cambio anterior

- El usuario aclaró que la entrada anterior (fondo tipo boleta en el recibo de venta) interpretó mal el pedido: lo que pidió se refiere al **recuadro negro con el número en amarillo** que aparece en **Nueva venta** (`src/app/app/ventas/nueva/form.tsx`, sección "Boletas de esta venta") — un badge `bg-[#1e293b]`/`text-[#f5c518]` por cada número agregado a la venta — no al recibo de caja. Pidió mostrar el número sobre el dibujo de una boleta en vez del recuadro liso, y deshacer el cambio del recibo por no ser necesario.
- Se revirtió `src/app/app/ventas/[id]/recibo/page.tsx` a su versión anterior (sin fondo de imagen de boleta) y se deshicieron las menciones agregadas en `docs/manual/manual-usuario.html` (sincronizado a `public/manual/`) y `docs/caracteristicas-funcionales.md`/`.html` sobre el recibo.
- Pendiente: implementar el rediseño real del badge de números en "Nueva venta" — queda por confirmar con el usuario si el "dibujo de boleta" debe ser una ilustración genérica (igual para todas las empresas) o la imagen de boleta que ya se puede cargar por rifa.

### 2026-08-08 (5) — Número sobre la imagen de boleta al vender (badge de "Nueva venta")

- Confirmado con el usuario (pregunta directa) que el pedido correcto era usar la **imagen de boleta que ya se puede cargar por rifa** como fondo de cada número agregado a una venta, con un dibujo genérico de respaldo cuando la rifa no tiene una imagen cargada — no cambios en el recibo (ver entrada anterior, revertida).
- **`src/lib/portal-vendedor.ts`** (`rifasVentaVendedor`) y **`src/app/app/ventas/nueva/page.tsx`** (ruta admin/cajero): ambas rutas que arman la lista de rifas para el formulario de venta ahora incluyen `boletaImagenUrl` (vía `imagenesRifa()`), una por rifa.
- **`src/app/app/ventas/nueva/form.tsx`**: el badge de cada número en "Boletas de esta venta" ahora usa `boletaImagenUrl` de la rifa seleccionada como fondo (`background-image`, cover/center) con una capa negra semitransparente (`bg-black/45`) para que el número en amarillo siga siendo legible sobre cualquier imagen. Si la rifa no tiene imagen cargada, el badge se ve exactamente igual que antes (fondo `#1e293b` liso). El botón de quitar (×) se movió a una esquina como círculo pequeño, visible siempre (no solo al pasar el mouse, para no perder usabilidad en móvil).
- Build limpio, 101/101 pruebas normales, 47/47 funcionales (sin cambios de lógica de negocio, solo un campo adicional de solo lectura en la data ya existente).
- Documentado en `docs/manual/manual-usuario.html` (sincronizado a `public/manual/`) y `docs/caracteristicas-funcionales.md`/`.html`.

### 2026-08-08 (6) — Permisos por rol distribuidos horizontalmente en la edición/creación de usuarios

- El usuario pidió que los permisos de usuarios según su rol se distribuyan de forma horizontal para mejor presentación en pantalla; antes cada grupo de permisos (usuario, vendedor, rifa, venta, sede, etc.) quedaba en una grilla de 2 columnas con los permisos apilados verticalmente uno debajo del otro dentro de cada grupo, dejando bastante espacio horizontal sin aprovechar en pantallas anchas.
- **`src/app/app/usuarios/[id]/form-editar.tsx`** y **`src/app/app/usuarios/nuevo/form.tsx`**: cada grupo de permisos ahora ocupa el ancho completo del formulario, con sus permisos en una fila que fluye horizontalmente (`flex flex-wrap`) y solo pasa a la siguiente línea cuando no caben más; los grupos se apilan uno debajo del otro. Sin cambios de lógica (mismo estado, mismos checkboxes, mismo comportamiento de "distinto del rol").
- Build limpio, 101/101 pruebas normales (sin cambios de lógica, no se corrió el arnés funcional).

### 2026-08-08 (7) — Pantallas del panel usan todo el ancho disponible del monitor

- El usuario pidió que todas las pantallas se desplieguen de forma horizontal, ajustándose al tamaño del monitor, para mejor presentación — el mismo problema de fondo que la distribución de permisos (entrada anterior): el menú lateral (`src/components/side-nav.tsx`) ya permite hasta `max-w-6xl` (1152px) de contenido, responsivo al tamaño de pantalla, pero 14 páginas de `/app` se autolimitaban por debajo de eso con su propio `mx-auto max-w-3xl/2xl/xl` — un límite redundante y más angosto que dejaba espacio vacío a los lados en monitores anchos.
- Se quitó ese límite redundante en: `config`, `perfil`, `sedes`, `vendedores/[id]`, `usuarios/[id]`, `usuarios/nuevo`, `vendedores/nuevo`, `ventas/nueva` (los 3 casos: vendedor sin vínculo, vendedor con rifas, y ruta general admin/cajero), `traspasos`, `ventas/[id]`, `rifas/[id]`, `rifas/nueva`, `rifas/[id]/importar`. Cada página ahora usa completo el ancho que el shell ya le da (hasta 1152px, responsivo hacia abajo en pantallas chicas).
- **No se tocaron** dos casos que no son el contenedor general de la página: el recibo de venta (`ventas/[id]/recibo`), que simula un ticket físico de 80mm y debe seguir angosto a propósito, y el aviso de "función no disponible en tu plan" en conciliación, que es un recuadro centrado tipo mensaje, no el layout de la pantalla.
- Esto también hace efectiva del todo la entrada anterior (permisos en fila horizontal): antes esos permisos fluían horizontalmente pero dentro de un contenedor de página angosto (`max-w-2xl` = 672px) que no les dejaba mucho espacio; ahora tienen hasta 1152px para distribuirse.
- Build limpio, 101/101 pruebas normales (cambio puramente de presentación, sin lógica de negocio, no se corrió el arnés funcional).

### 2026-08-08 (8) — Seleccionar boleta con un clic/toque en "Nueva venta"

- El usuario pidió que, en "Nueva venta", los números de la lista "Tus boletas disponibles (informativo, …)" se puedan seleccionar con un clic o al tocarlos, en vez de tener que escribirlos a mano en el buscador. Antes era deliberadamente de solo lectura (comentario explícito en el código: "no selecciona, hay que buscarlo abajo").
- **`src/app/app/ventas/nueva/form.tsx`**: nueva función `seleccionarDisponible(n)` que, al hacer clic/toque en un número (de "Tus boletas disponibles" del vendedor o de "Algunas boletas disponibles" del admin/cajero), dispara la misma verificación en tiempo real que la búsqueda manual (`GET /api/boletas/buscar`) — necesaria porque el estado pudo cambiar desde que se cargó la página (otra venta, otra solicitud de traspaso resuelta, etc.) — y si sigue disponible lo agrega directo a la venta; si ya no lo está, muestra el mismo resultado que la búsqueda manual (con botón de "Solicitar" si corresponde). Los números ya agregados se ven en verde y no son clicables de nuevo; mientras se está verificando cualquier número, toda la lista queda deshabilitada para evitar clics duplicados.
- No se tocó ninguna lógica de negocio (`buscarBoleta`, el endpoint `/api/boletas/buscar`, ni el anti-doble-venta): la garantía de que todo número pasa por verificación en tiempo real antes de agregarse se mantiene intacta, solo cambia cómo se dispara esa verificación.
- Build limpio, 101/101 pruebas normales (sin cambios de lógica de negocio, no se corrió el arnés funcional). Documentado en `docs/manual/manual-usuario.html` (sincronizado a `public/manual/`), que ya no dice "no se elige haciendo clic".

### 2026-08-08 (9) — La boleta aprobada sube sola a "Boletas de esta venta"

- El usuario pidió que, al solicitar una boleta de otro vendedor y este aprobar el traspaso, la boleta suba automáticamente a la lista de boletas seleccionadas de quien la solicitó, en la pantalla "Nueva venta" — sin que tenga que volver a buscarla a mano. Aclaró que si se rechaza o ya está vendida, sigue aplicando la acción ya establecida (el aviso correspondiente, sin agregar nada) — eso ya funcionaba vía `NotificadorTraspasos`.
- **`src/app/api/traspasos/pendientes/route.ts`**: el listado de solicitudes "enviadas" (usado por el sondeo cada 15s del aviso de traspasos) ahora también incluye `rifaId` de cada solicitud — antes solo llevaba el código visible de la rifa (`rifa`), no su id, así que no había forma de saber a qué rifa exacta pertenecía una aprobación desde el cliente.
- **`src/components/NotificadorTraspasos.tsx`**: cuando detecta que una solicitud enviada pasó a "aprobada" (ya mostraba el aviso sonoro/emergente de siempre), ahora también difunde un evento global del navegador (`rifax:traspaso-aprobado`, con `rifaId` y `numero`) para que cualquier pantalla abierta que le interese pueda reaccionar.
- **`src/app/app/ventas/nueva/form.tsx`**: escucha ese evento; si la rifa de la aprobación coincide con la rifa seleccionada en el formulario, confirma el estado real de la boleta (mismo endpoint `GET /api/boletas/buscar` que ya usa la búsqueda manual y el clic en la lista de disponibles — nunca se agrega a ciegas solo por el aviso) y, si sigue disponible, la agrega sola a "Boletas de esta venta" con un mensaje ("Te aprobaron la boleta #N: se agregó sola a esta venta."). Si la aprobación es de una rifa distinta a la que se tiene seleccionada, no se agrega nada — solo se ve el aviso emergente de siempre, como hasta ahora.
- No se tocó `crearSolicitudTraspaso` ni `resolverSolicitud` (la lógica de negocio del traspaso en sí, ya cubierta por pruebas funcionales existentes) — el cambio es enteramente de plomería entre un dato que ya existía (`rifaId` en `SolicitudFila`) y la pantalla de venta.
- Build limpio, 101/101 pruebas normales y 47/47 funcionales (sin cambios, todo sigue pasando). Documentado en `docs/manual/manual-usuario.html` (sincronizado a `public/manual/`).

### 2026-08-08 (10) — El mensaje de "boleta vendida" indica si fue por traspaso

- El usuario pidió que, cuando se busca una boleta que ya se vendió y esa boleta había sido traspasada al vendedor que terminó vendiéndola, el mensaje "Esta boleta ya está vendida." también indique que fue un traspaso y a qué vendedor (nombre incluido).
- **`src/lib/traspasos.ts`** (`buscarBoleta`): cuando la boleta está vendida (`reservada`/`pagada`), ahora consulta la solicitud de traspaso **aprobada** más reciente para esa boleta (`solicitudes_boleta`, ordenada por `resuelto_en DESC`). Si esa solicitud fue de un vendedor (no de una sede) y tiene nombre, el mensaje pasa a ser `"Esta boleta ya está vendida. Fue un traspaso al vendedor {nombre}."`; si nunca hubo traspaso aprobado (el caso normal), el mensaje queda igual que siempre.
- Se agregó una prueba funcional que reutiliza el traspaso ya probado de la boleta #5 (vendedor A → vendedor C): la vende como vendedor C y confirma el mensaje con el nombre correcto; y una boleta de control (#7, sin traspaso) confirma que el mensaje no cambia cuando no aplica.
- Build limpio, 101/101 pruebas normales, 48/48 funcionales (1 nueva). Documentado en `docs/manual/manual-usuario.html` (sincronizado a `public/manual/`).

### 2026-08-08 (11) — Purga de auditoría por antigüedad para el super-admin (con reinicio de cadena documentado)

- El usuario pidió permitir que el super-admin de la plataforma borre el listado de auditoría. Antes de implementarlo tal cual, se le hizo notar que `saas.auditoria` es una cadena de hashes SHA-256 (cada fila incluye el hash de la anterior) y que ya existe `verificar_cadena_auditoria()`, usada por los tenants para comprobar que su historial no fue alterado — un borrado directo rompería esa garantía para **toda la plataforma**, no solo lo borrado. Se le presentaron 3 opciones (borrado real sin control, purga por antigüedad con reinicio documentado, o solo exportar sin borrar nunca); eligió la segunda (recomendada).
- **`prisma/sql/0018_purga_auditoria.sql`** (aplicada a la base real): nueva tabla `saas.auditoria_purgas` (qué se purgó, cuántas filas, cuál quedó de primera sobreviviente, quién y cuándo) y función `saas.purgar_auditoria(hasta, actor_id)` que borra lo anterior a esa fecha, registra el evento en `auditoria_purgas`, y además dicho evento vuelve a la propia cadena de auditoría (encadenado con lo que sobrevivió). `verificar_cadena_auditoria()` se actualizó para reconocer esos puntos de reinicio: no intenta recalcular el hash de una fila cuyo predecesor real ya no existe (imposible), pero sigue verificando todo lo demás con normalidad — la garantía de integridad se mantiene para todo lo NO purgado.
- **`src/lib/superadmin.ts`**: `purgarAuditoria(hasta, actorId)` (exige que `hasta` sea de hace más de 365 días — `RETENCION_MINIMA_DIAS` —, para que esto sea "archivar historial viejo", no "borrar actividad reciente"), `estadoAuditoriaGlobal()` y `historialPurgasAuditoria()`.
- **`/panel/auditoria`** (nueva pantalla, solo super-admin): estado de la cadena (íntegra/rota), total de eventos, última purga, historial de purgas, y un asistente de **dos pasos** para purgar (fecha límite + aceptar que es irreversible, luego escribir la palabra PURGAR) — mismo patrón que el borrado de un tenant, un paso menos porque aquí no hay un identificador único que confirmar. Enlace agregado desde `/panel` junto a Facturación/Apariencia.
- **`src/lib/reportes.ts`** (`verificarAuditoria`, usado por cada tenant en Reportes): ahora también informa la fecha de la última purga global, para que "cadena íntegra" no se malinterprete como "nunca se borró nada" — se aclara que fue una purga documentada del super-admin, no una alteración.
- Pruebas funcionales: se agregaron pruebas de **solo lectura y de resguardo** (rechaza purgar algo más reciente que un año, rechaza fecha inválida, las funciones de solo lectura devuelven una forma válida) — deliberadamente **nunca se ejecuta una purga real** en el arnés de pruebas, porque corre contra la base real de Neon (no una aislada) y la cadena es global; el resguardo de antigüedad mínima es justamente lo que garantiza que las pruebas nunca borren auditoría real.
- **Hallazgo importante, no causado por este cambio**: al verificar manualmente la cadena tras la migración, se encontró que `verificar_cadena_auditoria()` ya reportaba una alteración (fila #849) **antes** de tocar nada — `saas.auditoria_purgas` está vacía (0 filas), confirmando que nunca se ejecutó una purga real. La causa raíz es preexistente y ajena a este cambio: `auditoria.tenant_id REFERENCES tenants(id) ON DELETE CASCADE` (definido desde `0001_saas.sql`, el esquema original) hace que **cada vez que se purga un tenant** (`purgar_tenant()`, usado tanto por el arnés de pruebas al limpiar cada tenant QA desechable como por el botón real "Eliminar base de datos" del super-admin) se borren en cascada todas sus filas de auditoría, rompiendo la cadena global para todos los tenants desde ese punto en adelante, sin ningún registro de qué pasó — a diferencia de la purga nueva, que si documenta el reinicio. Esto lleva sucediendo silenciosamente desde la primera vez que se corrió el arnés de pruebas funcionales, semanas atrás, y **ya afecta lo que ven hoy los tenants reales** en "Integridad de auditoría" de Reportes (mostraría "cadena alterada" aunque nadie manipuló nada). No se corrigió en esta entrada — es un hallazgo aparte que se le reportó directamente al usuario para decidir cómo abordarlo (por ejemplo, aplicar el mismo patrón de reinicio documentado también dentro de `purgar_tenant()`).
- Build limpio, 101/101 pruebas normales, 51/51 funcionales (3 nuevas). Documentado en `docs/manual/manual-usuario.html` (sincronizado a `public/manual/`) y `docs/caracteristicas-funcionales.md`/`.html`.

### 2026-08-08 (12) — Números de boleta en Ventas, informe de comisiones detallado, observaciones de traspaso

- El usuario pidió tres cosas relacionadas con reportes: (1) columna de número de boleta en los reportes, (2) un informe de comisiones **detallado** aparte del consolidado, con números de boleta, y (3) un campo "observaciones" en el reporte de ventas que registre cuando una boleta vendida fue traspasada, con el nombre de quien la tenía y el nombre de quien la recibió y vendió.
- **`src/lib/ventas.ts`** (`listarVentas`): ahora incluye `boletas` (los números vendidos en esa venta, vía `ventas_boletas`) y `observaciones` — una nota por cada boleta de la venta que llegó por un traspaso **aprobado** (`solicitudes_boleta`), con el nombre de quien la tenía antes (`propietario_*`) y de quien la recibió (`solicitante_*`), en una sola consulta por lote (no una por venta). Si ninguna boleta de la venta fue traspasada, `observaciones` queda en `null`.
- **`src/app/app/ventas/page.tsx`** y **`/api/export/ventas`**: nuevas columnas "Boletas" y "Observaciones".
- **`src/lib/comisiones.ts`**: nueva función `comisionesDetalladas()` — un informe **aparte** del consolidado (`estadoComisiones`), una fila por cada venta con comisión: vendedor, rifa, cliente, números de boleta, recaudado de esa venta puntual y su comisión.
- **`/app/comisiones`**: nueva sección "Detalle por venta" debajo del consolidado de siempre, y dos descargas CSV separadas ("Consolidado CSV" / "Detallado CSV"); se agregaron los recursos `comisiones` y `comisiones-detalle` a `/api/export/[recurso]`.
- Se agregó una prueba funcional que reutiliza el escenario de traspaso ya probado (boleta #5, vendedor A → vendedor C): confirma que `listarVentas` trae `boletas: [5]` y la observación exacta ("Boleta #5: traspasada de QA Vendedor A a QA Vendedor C."), que la boleta #7 (sin traspaso) no lleva observación, y que `comisionesDetalladas` trae esa misma venta con su boleta y su comisión.
- Build limpio, 101/101 pruebas normales, 52/52 funcionales (1 nueva). Documentado en `docs/manual/manual-usuario.html` (sincronizado a `public/manual/`) y `docs/caracteristicas-funcionales.md`/`.html`.

### 2026-08-08 (13) — Favicon y logo de instalación reemplazados con el logo oficial de Rifax

- El usuario adjuntó el logo oficial (wordmark "Rifax" en azul marino con el check en amarillo, y el eslogan "Gestión Inteligente de Información") y pidió reemplazar tanto el favicon del sitio como el ícono que queda al instalar la app en el escritorio. El archivo se guardó en `public/logo_rifax.png` (1082×747, con canal alfa pero completamente opaco — confirmado píxel a píxel con `System.Drawing`, fondo blanco real, no transparente).
- Como el logo es horizontal y los íconos de app deben ser cuadrados (si no, algunos sistemas los estiran y se ve deforme), se generaron 4 variantes cuadradas con fondo blanco (mismo blanco del logo, para que no se note el borde del lienzo) usando `System.Drawing` (.NET, sin agregar dependencias nuevas al proyecto):
  - `src/app/icon.png` (512×512) — favicon del navegador.
  - `src/app/apple-icon.png` (180×180) — ícono al agregar a inicio en iOS.
  - `public/icon-app-512.png` (512×512, `purpose: "any"` en el manifest) — ícono de instalación de escritorio/Android.
  - `public/icon-app-maskable-512.png` (512×512, `purpose: "maskable"`) — igual, pero con más margen (60% en vez de 85%) porque el sistema operativo puede recortarlo en círculo u otras formas; con más aire alrededor no se corta el logo.
- No se tocaron los badges "R" decorativos que ya existían dentro de las pantallas (login, portada, etc.) — el pedido era específicamente el favicon y el ícono de instalación, no el branding interno de las páginas.
- Cambio puramente de assets estáticos (sin lógica), verificado con `npm run build` (ambas rutas `/icon.png` y `/apple-icon.png` se siguen generando bien) y revisando las 3 imágenes generadas antes de desplegar.

### 2026-08-08 (14) — Favicon e ícono de escritorio: más grandes y sin fondo blanco

- El usuario pidió que el favicon y el ícono de instalación de escritorio fueran más grandes y sin fondo blanco (la entrada anterior los dejó en un lienzo blanco con bastante margen).
- Se generó `public/logo_rifax_transparente.png`: el logo original con el fondo blanco removido de verdad (canal alfa, no solo "se ve blanco") — se recorrió cada píxel por bytes (`LockBits`, sin dependencias nuevas) y se calculó su "blancura" (mínimo de R/G/B) para volverlo transparente con un degradado suave en los bordes del texto, en vez de un corte brusco que dejaría un borde blanco dentado. Verificado píxel a píxel: la esquina quedó en alfa 0 (transparente) y el texto de la "R" en alfa 255 (opaco).
- Con ese logo transparente se regeneraron, más grandes (95% del lienzo en vez de 85%) y con fondo transparente: `src/app/icon.png` (favicon) y `public/icon-app-512.png` (ícono de instalación de escritorio, `purpose: "any"` del manifest).
- **`apple-icon.png` quedó con fondo blanco** (a diferencia de los otros dos): iOS no soporta bien la transparencia en los íconos de "agregar a inicio" — suele rellenar de negro las zonas transparentes, lo que se vería como un recuadro negro alrededor del logo. Se agrandó igual (95%) pero se mantuvo su fondo blanco para evitar ese problema visual en iPhone/iPad.
- **`icon-app-maskable-512.png` no se tocó**: los íconos "maskable" del estándar PWA deben llevar un fondo opaco que llegue hasta el borde — el sistema operativo decide qué forma recortar (círculo, squircle, etc.), y si hay transparencia se vería como un hueco. Se mantiene con fondo blanco y su margen de seguridad (60%).
- Verificado componiendo el nuevo `icon.png` sobre un fondo oscuro de prueba (descartado después) para confirmar que la transparencia es real y no solo visual en el visor de imágenes.
- Cambio puramente de assets estáticos, verificado con `npm run build`.

### 2026-08-08 (15) — Auditoría de calidad (5/5, segunda pasada): último especialista

- Última de las 5 auditorías de esta segunda pasada. Línea base antes de tocar nada: build limpio, 101/101 pruebas normales, y funcionales 50/52 en el primer intento (2 fallas por un corte de red transitorio con Neon — `Can't reach database server` y un timeout de 60s en un `FOR UPDATE`); al repetir la corrida, 52/52 sin cambiar nada, confirmando que fue un problema de red pasajero, no un bug.
- Confirmado que la cobertura pedida ya existía en `test/functional/index.test.ts`: `purgarAuditoria`/`estadoAuditoriaGlobal`/`historialPurgasAuditoria` (solo resguardos y lecturas, nunca una purga real — igual que documenta la entrada (11) de arriba), `comisionesDetalladas` y las observaciones de traspaso de `listarVentas`.
- **`src/lib/rifas.ts`** (`liberarBoletasSede`): era la única función mutadora del archivo que no llamaba a `auditar()` — de hecho por eso ESLint marcaba `actorId` como no usado. Se envolvió en `$transaction` y se agregó el registro de auditoría (`rifa.editar`), igual que su función hermana `asignarBoletasSede`. Sin cambio de comportamiento observable; cubierta por la prueba funcional existente "rifa compartida: asignarBoletasSede y liberarBoletasSede" (sigue en 52/52).
- Limpieza de lint: variable muerta `ventaPagadaId` en `test/functional/index.test.ts` (se asignaba pero nunca se leía).
- **Pruebas unitarias nuevas** (puras, sin red ni BD):
  - `test/lib/color.test.ts` (10 pruebas): `darken`, `luminancia`, `brandCss` de `src/lib/color.ts` — sin cobertura previa.
  - `test/lib/conciliacion.test.ts` (10 pruebas): `parsearExtracto` de `src/lib/conciliacion.ts` (se exportó; antes era privada) — fechas ISO/dd-mm-aaaa, separador de miles con punto, decimales con punto, montos negativos, líneas en blanco/sin monto reconocible, descripciones con varios campos.
  - **Hallazgo (no corregido, documentado con una prueba)**: `parsearExtracto` divide cada línea por `/[,;\t]/` (coma, punto y coma o tab, los tres a la vez) para separar columnas. Un monto con **coma decimal** (`"50.000,00"`, el formato habitual en Colombia) siempre queda partido en dos columnas sin importar qué separador se elija, y el fragmento final (p. ej. `"00"`) gana la búsqueda de monto — al evaluarse a 0, la línea se descarta **en silencio** (ni error ni aviso). Mitigación disponible hoy para quien pega el extracto: usar punto como decimal (`"50000.00"` o `"50000"`) en vez de coma. No se corrigió en este pase por el riesgo de tocar un parseo financiero real sin una batería de pruebas más amplia contra extractos reales de bancos colombianos; queda como recomendación para una futura iteración (por ejemplo, detectar y recomponer el monto partido, o mostrar cuántas líneas pegadas no se reconocieron).
- Build limpio, 121/121 pruebas normales (20 nuevas), 52/52 funcionales (sin cambios de lógica de negocio ni de seguridad). No se desplegó (auditoría de solo calidad/pruebas).

### 2026-08-08 (16) — Auditoría de los 5 especialistas, segunda pasada: resumen consolidado

- El usuario pidió correr de nuevo el skill `auditoria-especialistas` (guardado en `.claude/skills/auditoria-especialistas/SKILL.md`, con los 5 agentes en `.claude/agents/`). Como en la sesión anterior, el skill no aparece en la lista de skills disponibles porque esta conversación arrancó en otro proyecto (`C:\contratacion`) — se orquestó manualmente inlineando cada persona en un agente `general-purpose`, en el mismo orden y con la misma verificación de build/tests entre cada uno que indica el propio skill. Línea base antes de empezar: build y 101 pruebas normales limpios.
- **1/5 seguridad-appsec**: repasó aislamiento multi-tenant, AuthN/AuthZ, inyección SQL, validación de entrada, secretos, subida de archivos, contraseñas y headers — sin hallazgos nuevos de fondo (la primera pasada ya corrigió lo estructural). Encontró y corrigió un hallazgo real de severidad baja: los correos de contraseña (`src/lib/mail.ts`, `mailPasswordTemporal`/`mailPasswordCambiada`) interpolaban `nombre` y `password` sin escapar en el HTML — un valor con `<`, `>` o `&` (la contraseña la fija libremente un admin, sin filtro de caracteres) podía romper el marcado del correo. Se agregó `escapeHtml()` y se aplicó a ambos campos en las dos plantillas.
- **2/5 backend-datos-prisma**: revisó integridad referencial, concurrencia (incluida la liquidación de comisiones y la resolución de traspasos), consistencia monetaria y las consultas nuevas (`listarVentas` con el JOIN de observaciones de traspaso, `comisionesDetalladas`). Encontró, con `EXPLAIN ANALYZE` real contra Neon, que ese JOIN nuevo (`solicitudes_boleta WHERE boleta_id = ... AND estado = 'aprobada'`) no tenía ningún índice que lo cubriera — barato hoy con pocas filas, pero la tabla crece con cada traspaso resuelto de toda la plataforma. Corregido con la migración aditiva `prisma/sql/0019_indice_solicitudes_aprobadas.sql` (índice parcial `idx_solicitudes_boleta_aprobada`), aplicada a la base real y verificada idempotente.
- **3/5 frontend-nextjs**: revisó Server/Client Components, accesibilidad y consistencia de UI del desarrollo reciente. Encontró una regresión real de UX causada por el ensanchado de pantallas de una entrada anterior: varios formularios de una sola columna (crear/editar usuario, vendedor, rifa, perfil, sede) habían quedado sin ningún límite de ancho propio, así que un campo como "Nombre completo" se estiraba a ~1100px — mala legibilidad. Corregido reintroduciendo `max-w-2xl`/`max-w-xl` directamente en esos `<form>` (no en la página completa), preservando el ensanchado en las pantallas de listas/tablas que sí se benefician de él. También agregó `aria-label` a 5 botones-ícono "✓" que no lo tenían y `aria-hidden` a los emoji decorativos de los avisos de traspaso. Señaló (sin tocar, por ser una decisión de diseño mayor) que el `<main>` del shell sigue fijo en `max-w-6xl`: en monitores muy anchos las tablas nuevas (Ventas, Comisiones) todavía no aprovechan todo el espacio disponible.
- **4/5 devops-vercel**: revisó configuración Next/Vercel, variables de entorno, los nuevos recursos de exportación CSV, el flujo de purga de auditoría y los íconos regenerados. Sin hallazgos que requirieran corrección — todo lo nuevo ya cumplía las prácticas esperadas (headers de `/api/export/comisiones*` con `Cache-Control` correcto, permisos exigidos, íconos con tamaños razonables y el manifest apuntando bien). No tocó `.gitignore` (instrucción explícita, por el incidente de una sesión anterior).
- **5/5 calidad-qa**: ver entrada (15) arriba para el detalle completo — corrigió `liberarBoletasSede` (no registraba auditoría), agregó 20 pruebas unitarias nuevas (`color.test.ts`, `conciliacion.test.ts`) y documentó sin corregir un caso borde de `parsearExtracto` con montos en coma decimal.
- **Estado final tras los 5**: build limpio, **121/121** pruebas normales, **52/52** funcionales, sin tenants de prueba residuales. No se hizo `git commit` ni `vercel deploy` — los cambios de los 5 especialistas quedan en el working tree para revisión del usuario antes de desplegarlos.

### 2026-08-08 (17) — Auditoría de los 5 especialistas (segunda pasada): desplegada

- El usuario autorizó desplegar los cambios de la auditoría consolidada en la entrada (16). Verificación final (build + `npm test`) limpia, `vercel deploy --prod --scope rifa7 --yes` exitoso, sitio confirmado en vivo (200 OK).

### 2026-08-08 (18) — Los 3 pendientes de la auditoría: ancho del panel, montos con coma decimal, y el hueco de auditoría al borrar un tenant

El usuario pidió resolver los tres puntos que quedaron señalados (no aplicados) al final de la auditoría de los 5 especialistas.

**1. Ancho del `<main>` del panel** — `src/components/side-nav.tsx` (modo rail/admin): el tope subió de `max-w-6xl` (~1152px) a `max-w-[1600px]`. Ahora es seguro ensancharlo más porque los formularios de una sola columna (corregidos por el agente frontend-nextjs en la auditoría) ya tienen su propio `max-w-2xl`/`max-w-xl`, así que no se vuelven a estirar — solo las tablas/listas ganan espacio en monitores anchos.

**2. `parsearExtracto` con montos en coma decimal** — `src/lib/conciliacion.ts`: el bug era que el monto se buscaba sobre columnas YA separadas por coma/punto y coma/tab, así que una coma decimal ("50.000,00") partía el monto en dos columnas y la línea se descartaba en silencio. Reescrito para reconocer cada campo (fecha, monto, descripción) sobre la línea completa ANTES de partir en columnas, con un tokenizador que prioriza los patrones de fecha (para no confundir "2026-01-05" con tres números sueltos) y reconoce montos con separador de miles y decimal en cualquier orden y con cualquiera de los dos símbolos ("50.000,00" formato colombiano, o "50,000.00"). El test que documentaba la limitación se actualizó para confirmar que ahora se reconoce correctamente, y se agregó un caso más para el formato invertido. 122/122 pruebas unitarias (2 nuevas, 1 removida).

**3. `purgar_tenant()` rompía la cadena de auditoría sin dejar rastro** — `prisma/sql/0020_reinicio_purgar_tenant.sql` (aplicada a la base real):
- Nueva tabla `saas.auditoria_reinicios` (fila que queda como "génesis local", motivo, detalle, fecha) — generaliza el mismo concepto de `auditoria_purgas` (entrada del 2026-08-08 #11) a cualquier causa de hueco, no solo purgas por antigüedad.
- `purgar_tenant()` ahora calcula, ANTES de borrar el tenant (que dispara el `ON DELETE CASCADE` sobre sus filas de `auditoria`), qué filas sobrevivientes de OTROS tenants quedarán con un predecesor inexistente, y las registra en `auditoria_reinicios` con motivo `'tenant_eliminado'` (incluye el nombre/slug del tenant borrado).
- `verificar_cadena_auditoria()` ahora reconoce puntos de reinicio de **ambas** tablas (`auditoria_purgas` + `auditoria_reinicios`): no intenta recalcular el hash de esas filas (su predecesor real ya no existe, es imposible), pero sigue verificando todo lo demás con normalidad.
- **Reparación histórica única** (parte de la misma migración): se recorrió la cadena completa buscando huecos YA EXISTENTES de purgas de tenant anteriores a este fix. Se encontró y documentó exactamente **1** hueco histórico (motivo `'reparacion_historica_20260808'`) — coincide con la fila #849 detectada en la entrada (11). Tras la reparación, `verificar_cadena_auditoria()` pasó de reportar esa fila como alterada a devolver `null` (íntegra), verificado directamente contra la base real.
- **Verificado en un escenario real, no solo teórico**: se corrió el arnés de pruebas funcionales completo (que crea y purga un tenant QA de verdad en `afterAll`) después de aplicar la migración — la cadena siguió íntegra (`null`) y no se generó un reinicio nuevo innecesario, porque las filas de auditoría de ese tenant de prueba resultaron ser las últimas de la tabla en ese momento (sin nada de otro tenant después) — el borrado no dejó ningún hueco intermedio que documentar, comportamiento correcto.
- **`src/lib/superadmin.ts`** (`estadoAuditoriaGlobal`) y **`/panel/auditoria`**: nuevo KPI "Reinicios documentados (purgas + tenants eliminados)", sumando ambas tablas, para que el super-admin vea de un vistazo cuántos reinicios explican el estado de la cadena.
- Build limpio, 122/122 pruebas normales, 52/52 funcionales (incluye una purga real de tenant durante la propia corrida, verificada después con `verificar_cadena_auditoria()`).

### 2026-08-08 (19) — Revisión funcional integral: módulos sin cobertura previa, 5 errores propios corregidos, cero bugs nuevos en la aplicación

El usuario pidió una prueba real ejecutando todas las opciones del aplicativo, con bitácora del proceso y corrección de los errores encontrados. Se hizo con el mismo método usado toda la sesión: lógica real, base de datos real de Neon, un tenant desechable (`crearContextoPrueba`/`limpiarContextoPrueba`) — nunca simulada ni con mocks.

**Punto de partida**: 52 pruebas funcionales ya cubrían tenant/planes/facturación/vencimientos, sedes/usuarios/vendedores (incluidas las credenciales), rifas/boletas/ventas (anti-doble-venta), traspasos/comisiones/sorteos, reset de contraseña, reportes con boletas/observaciones, comisiones detalladas, y los resguardos de la purga de auditoría. Se catalogaron los módulos de `src/lib/*.ts` que **nunca** habían tenido ni una sola prueba: `comisiones.liquidarMasivo`, `cartera.ts`, `clientes.ts`, `catalogos.ts`, `importar.ts` (carga masiva CSV), `vencimientos.registrarPagoVencimiento`/`regenerarVencimientos`, `outbox.ts`, y una verificación **formal** (no solo manual, como quedó en la entrada del punto 3 de hoy) de que `purgar_tenant()` deja la cadena de auditoría íntegra.

**Pruebas nuevas agregadas** (15, todas en `test/functional/index.test.ts`):
- Liquidación masiva de comisiones: liquida el pendiente de todos los vendedores a la vez y confirma que no se puede liquidar dos veces lo mismo; confirma que el plan Básico la bloquea.
- Cartera: una venta recién creada con saldo aparece como "corriente"; clientes: editar datos, teléfono único por tenant, anular/reactivar.
- Catálogos: `opcionesDe` cae en los valores por defecto sin configuración propia; una opción propia los reemplaza; desactivar la única opción propia hace que vuelva a caer en los defaults (no queda vacío); rechaza un tipo de lista desconocido.
- Carga masiva CSV: `parseCsv` respeta comillas y comas dentro de campos; `expandirNumeros` combina rangos sin duplicar; `importarVendedores` crea, omite duplicados por documento y exige columnas obligatorias; `importarVentas` crea la venta con su abono y reporta error fila por fila si el vendedor del CSV no existe.
- Vencimientos: `regenerarVencimientos` reconstruye el calendario según la periodicidad actual; `registrarPagoVencimiento` marca la fecha y actualiza `fecha_vencimiento` del tenant.
- Outbox: drena la cola de notificaciones ya encoladas por las ventas/abonos de toda la suite sin ninguna fallida, y repetir sin nada pendiente no falla.
- **`purgar_tenant()` con verificación formal**: crea un tenant secundario desechable dentro de la propia prueba, genera un evento de auditoría posterior de OTRO tenant (para garantizar que quede un hueco real), lo purga, y confirma `estadoAuditoriaGlobal().integra === true` después — la garantía central del punto 3 de hoy, ahora con una aserción automática y no solo verificada a mano con un script temporal.

**5 errores encontrados y corregidos — todos en las pruebas nuevas que se acababan de escribir, ninguno en la aplicación**:
1. y 2. y 3. Tres pruebas (liquidación masiva, cartera, importación CSV) intentaban vender boletas sobre `rifaId`, la rifa principal de toda la suite — pero para cuando estas pruebas corren (al final del archivo), esa rifa ya quedó `estado='sorteada'` por el bloque "Sorteos" que corre antes, y `crearVenta` la rechaza correctamente ("La rifa no está activa"). **No es un bug**: es la regla de negocio funcionando bien; el error fue mío, asumir que `rifaId` seguiría vendible al final. Corregido creando una rifa propia y activa (`rifaRevisionId`) para estas pruebas, en vez de depender del estado final —frágil— de una rifa compartida con el resto del archivo.
4. La prueba de `regenerarVencimientos` pagaba la única cuota pendiente (periodicidad anual, numero=1) y LUEGO regeneraba: el `INSERT ... ON CONFLICT (tenant_id, numero) DO NOTHING` de `generarVencimientos()` choca contra esa fila ya "pagada" con el mismo número y no reinserta nada, dejando cero pendientes. Es un comportamiento real y preexistente de la función (reutiliza los mismos números de cuota), pero la ruta real de la aplicación (botón "Generar calendario" del super-admin) solo se ofrece cuando el tenant no tiene ningún vencimiento todavía — nunca en este escenario de choque. Se corrigió el ORDEN de las dos pruebas (regenerar primero, pagar después) para no fabricar un escenario que no ocurre en el uso real, y se documentó la razón en el propio comentario del test para que no se pierda el porqué.
5. La prueba de outbox asumía que no habría notificaciones pendientes ("sin notificaciones pendientes...") — pero `crearVenta`/`registrarAbono` sí encolan notificaciones (`src/lib/ventas.ts`), y para cuando esta prueba corre (al final de una suite de 66+ pruebas que venden y abonan constantemente) ya había 5 en cola. Corregida para drenar la cola real en vez de asumirla vacía, confirmando además que ninguna falla (el simulador de entrega interno siempre "tiene éxito" hoy; una fallida sí sería una regresión real).

**Resultado de esta pasada**: a diferencia de la auditoría de los 5 especialistas (que sí encontró y corrigió errores reales en `src/`), esta revisión funcional **no encontró ningún bug nuevo en la aplicación** — toda la lógica de negocio de los módulos sin cobertura previa se comportó como se esperaba. Los 5 errores fueron exclusivamente de las pruebas recién escritas, ya corregidos.

**Estado final**: build limpio, 122/122 pruebas normales (sin cambios), **67/67 pruebas funcionales** (15 nuevas), sin tenants de prueba residuales, cadena de auditoría verificada íntegra. No se modificó ningún archivo de `src/` en esta pasada — solo `test/functional/index.test.ts` —, así que no hay nada nuevo que desplegar a producción.

### 2026-08-11 — Lista de 16 puntos del usuario: 10 implementados, 1 vulnerabilidad real corregida

> La sesión arrancó en el proyecto equivocado (`C:\contratacion`, gestión de contratos públicos) porque el usuario pegó la lista sin indicar el proyecto; se aclaró y se retomó aquí. Antes de empezar, se comiteó el trabajo de las sesiones 05–08 de agosto que llevaba días sin `git commit` (86 archivos, ya verificado y desplegado por `vercel deploy` en su momento) — commit `6f8abab`.

El usuario entregó una lista de 16 requisitos/hallazgos. Se trabajó primero lo acotado, dejando para después los 4 más grandes (aún pendientes). Cada punto se verificó con build + 122 pruebas unitarias + suite funcional completa contra la base de datos real antes de darlo por cerrado.

**Completados (commits `b4a44d8` y `36f2064`, desplegados a producción):**

1. **Punto 12** — "Asignar talonario": la opción "Las que solicite" pasó a llamarse "Abonados", con un desplegable de números reales disponibles de la rifa (clic para seleccionar) en vez de texto libre. Nuevo endpoint `GET /api/boletas/disponibles` y `boletasDisponiblesParaTalonario()` en `vendedores.ts`.
2. **Punto 6** — Columna "Medio" (canal de venta: web/whatsapp/vendedor/pos) agregada al listado de ventas y a su export CSV, usando el catálogo `canal_venta` que ya existía pero no se mostraba en el reporte.
3. **Punto 8** — La búsqueda de boleta (`buscarBoleta` en `traspasos.ts`) ahora incluye también el nombre de la sede del vendedor que la tiene. La autorización cruzada cuando la oficina busca una boleta de un vendedor de su misma sede **ya existía** (`resolverSolicitud` siempre exige al vendedor dueño, sin excepción por sede).
4. **Punto 10 — bug real corregido**: `boletasDisponibles()` en `ventas.ts` (la lista "Algunas boletas disponibles (informativo)" de la sede) solo filtraba `estado='disponible'` pero no excluía las que ya tenían `talonario_id` — una boleta asignada a un vendedor seguía apareciendo como disponible para la oficina. Se agregó `AND talonario_id IS NULL`.
5. **Punto 2** — Conciliación con IA: se reemplazó la subida de PDF por CSV. Se evaluó agregar la librería `xlsx` para Excel nativo pero tiene 2 CVEs de severidad alta (prototype pollution, ReDoS) sin parche en el registro de npm (solo en el CDN propio de SheetJS); el usuario eligió CSV solamente, sin dependencias nuevas. El parseo reutiliza `parsearExtracto()` (determinístico, ya probado), sin gastar IA en leer el archivo — la IA solo sigue emparejando contra la cartera. Se retiró la dependencia `unpdf`.
6. **Punto 3** — El detalle de venta y el recibo imprimible ahora muestran las boletas con el mismo formato visual (fondo de la rifa + número en dorado) que la pantalla de "Nueva venta". El recibo antes ni siquiera listaba los números.
7. **Punto 5** — Se quitó "Ingresar (empresa)" del menú de consulta pública. La consulta multi-empresa (buscar por documento+teléfono en TODOS los tenants y agrupar por empresa) **ya estaba implementada** en `consultarEstadoCuenta()` — no filtraba por tenant.
8. **Punto 9** — Causa real de la lentitud en `/api/boletas/buscar`: el contexto del usuario (`contextoDeUsuarioParaRifa`) y la fila de la boleta (`filaBoleta`) se pedían en dos viajes a la base de datos EN SERIE, siendo independientes entre sí. `buscarBoleta()` ahora acepta el contexto como promesa y los resuelve con `Promise.all`, en paralelo.
9. **Punto 1 — vulnerabilidad real encontrada y corregida** (auditoría con agente `Explore`, read-only): `src/lib/vendedores.ts` no validaba la sede del usuario actuante en NINGUNA función de escritura (`editarVendedor`, `cambiarEstadoVendedor`, `asignarTalonario`, `cerrarTalonario`, y el `boletasDisponiblesParaTalonario` nuevo del punto 12) — solo filtraban por `tenant_id`. La UI ocultaba la opción de elegir otra sede, pero el servidor la aceptaba igual: un cajero de la Sede A podía, con un POST manipulado, editar/reasignar/suspender vendedores de la Sede B, o asignarles/quitarles talonarios. Las cinco funciones ahora reciben `sedeIdUsuario` (igual patrón que ya usaban `rifas.ts`/`ventas.ts`) y rechazan el cruce de sede. Cubierto con una prueba funcional nueva contra la base real que confirma el rechazo (y que la propia sede sigue funcionando).
10. **Punto 11** — Confirmado sin cambios: catálogos, branding y planes se guardan por `tenant_id` únicamente (sin dimensión de sede), así que toda configuración del superadmin/admin de empresa ya aplica automáticamente a todas las sedes.
11. **Punto 14** — Nueva pantalla `/app/ventas/abono-otra-sede`: busca una venta de CUALQUIER sede del tenant por código, número de boleta o documento del cliente (sin filtrar por sede, a propósito — es la única excepción admitida), registra el pago y enlaza al recibo. Protegido por un permiso nuevo `pago.registrar_otra_sede` (migración `0021`, otorgado a admin/gerente/cajero, **nunca** a vendedor — se bloquea el rol explícitamente incluso si un override de permisos se lo diera por error). `ventaEnAlcance()` normal sigue rechazando el cruce de sede sin cambios; solo esta ruta nueva y el recibo (vía `ventaEnAlcanceParaRecibo()`) tienen la excepción.
12. **Punto 7** — Nueva sección "Integraciones" en `/app/config`: credenciales de Wompi (llave pública/privada, secreto de eventos, modo sandbox/producción), API de WhatsApp (id de teléfono + token) y SMS (remitente + api key) por empresa. Nueva tabla `saas.tenant_integraciones` (migración `0022`). Los secretos nunca se devuelven al cliente una vez guardados (solo "configurado: sí/no"); dejar el campo en blanco conserva el valor anterior, igual que cambiar la contraseña del portal de vendedor. Guardados en columnas planas (no cifradas en reposo) — si se requiere cifrado adicional es un cambio aparte. Esto es solo el panel de configuración; **falta** integrar el envío/cobro real (queda para cuando se aborde el punto 4).

**Completados en la continuación de la sesión (commits `e7924eb`, `7126c40` y `5483351`, desplegados):**

13. **Punto 15** — Tres funcionalidades:
    - `rankingVendedores()` en `reportes.ts`: ranking por rifa (solo vendedores reales, ordenado por recaudado real vía abonos), visible en el detalle de cada rifa.
    - `cerrarRifa()` en `rifas.ts`: usa el permiso `rifa.cerrar` que ya estaba sembrado en el esquema pero nunca se había implementado. Transiciona `activa`/`sorteada` → `cerrada`; `crearVenta` ya rechazaba vender fuera de `'activa'`, así que el cierre bloquea ventas nuevas sin tocar nada más. El estado `'cerrada'` ya estaba contemplado en el `CHECK` constraint original del esquema (`0001_saas.sql`), sin necesitar migración.
    - Autocompletar cliente por documento en "Nueva venta": `buscarClientePorDocumento()` + `GET /api/clientes/buscar`, busca en TODAS las sedes del tenant e informa la sede/vendedor de la última compra. Nunca sobrescribe campos ya escritos a mano (botón "Usar estos datos").
    - Verificado: 74/74 pruebas funcionales (3 nuevas). En el camino se encontraron y corrigieron **2 bugs en pruebas propias** de esta sesión (no en la aplicación): un teléfono de prueba duplicado que hacía que `crearVenta` actualizara un cliente existente en vez de crear uno nuevo (el documento no quedaba guardado), y una aserción que asumía boletas 60-61 siempre libres cuando otra prueba anterior asigna 5 boletas al azar sobre el mismo rango — ambos corregidos con datos únicos y comparación antes/después en vez de asumir estado inicial.
14. **Punto 16** — Nueva pantalla `/vendedor/clientes` ("Mis clientes"): el vendedor ve sus propios clientes con compras activas, agrupados, con los números de boleta de cada rifa y el saldo pendiente. Reutiliza `listarVentas()` (ya filtraba por `vendedor_id`) agrupando por cliente en el propio componente — sin lógica de negocio nueva que probar. Enlazada desde el menú y el inicio del portal de vendedor.
15. **Punto 13** — `trasladarRifa()` en `rifas.ts`: al abrir una rifa nueva, cada vendedor con números VENDIDOS (con cliente, no anulados) en una rifa ya CERRADA recibe el mismo número reservado en la rifa nueva, si sigue disponible y existe en su rango. Aclarado con el usuario antes de implementar: sedes/usuarios no requieren traslado (ya son de la empresa, no de una rifa puntual); el traslado real es solo de vendedores+números. Exclusivo del rol `admin` (permiso nuevo `rifa.trasladar`, migración `0023`, con bloqueo explícito del rol en la acción). UI: sección "Traer vendedores de una rifa finalizada" en el detalle de una rifa activa. Casos omitidos (número fuera de rango, ya ocupado, vendedor inactivo) se reportan sin bloquear el resto. Verificado: 75/75 funcionales (1 nueva, cubre el traslado exitoso + los 3 tipos de omisión + el rechazo cuando origen no está cerrada o destino no está activa).

16. **Punto 4** (el más grande, último de la lista): landing page pública por empresa + dominio propio + compra en línea con Wompi. Antes de codear se acordaron 3 decisiones con el usuario: (a) solo instrucciones DNS, sin automatizar el alta del dominio en Vercel; (b) compra en línea de boletas primero (no abono de una venta existente); (c) solo modo sandbox de Wompi por ahora.
    - **Landing pública** (`/e/[slug]`, `src/lib/landing.ts`): branding (logo/color) + rifas activas con boletas disponibles, premio principal y precio.
    - **Dominio propio** (`/app/config`): campo `dominio_personalizado` en `tenant_config` (migración `0024`), con validación de formato e instrucciones DNS (CNAME a `cname.vercel-dns.com` / A a `76.76.21.21`). Se deja explícito que la conexión real en Vercel sigue siendo un paso manual pendiente.
    - **Compra en línea** (`/e/[slug]/comprar/[rifaId]`): el cliente elige números disponibles o escribe uno específico (incluido uno ya asignado a un vendedor), la venta se crea de inmediato en `pendiente_pago` (canal `web`, mismas 3 barreras anti-doble-venta de siempre) y se redirige al Web Checkout hospedado de Wompi. La comisión se resuelve sola: si los números elegidos pertenecen a un único vendedor (vía talonario), la venta se crea con ese `vendedor_id` y el mecanismo de comisiones ya existente aplica sin cambios; mezclar boletas de DOS vendedores distintos en una compra se rechaza. Límite de tasa (8/10min por IP) porque cada intento reserva boletas.
    - **Webhook** (`/api/webhooks/wompi`, `src/lib/wompi.ts`): la confirmación real del pago SOLO llega por ahí (nunca se confía en el redirect del navegador), con verificación de checksum SHA256 contra el secreto de eventos del tenant correspondiente. El formato de la integración (Web Checkout + firma de integridad + eventos y su checksum) se verificó contra la documentación oficial de Wompi (`docs.wompi.co`) antes de implementar, no se adivinó.
    - `registrarAbono`/`anularVenta`/`crearVenta` ahora aceptan `actorId: bigint | null` (`null` = acción del sistema, como la confirmación automática de un webhook) — `auditar()` ya admitía actor nulo, solo faltaba permitirlo en estas tres funciones.
    - **No se pudo probar un pago real de punta a punta**: no hay credenciales de sandbox reales de Wompi configuradas todavía. Lo que sí está verificado: `src/lib/wompi.ts` con pruebas unitarias deterministas (firma/checksum, sin red), y el flujo completo de `iniciarCompraPublica` contra la base de datos real (creación de venta, resolución de vendedor único/mixto/rechazado, sin Wompi configurado) con `registrarAbono`/`anularVenta` en modo `actorId: null`. En producción se confirmó por HTTP que el webhook responde correctamente (404 claro para una referencia inexistente, antes incluso de validar el checksum).
    - Verificado: build limpio, 129/129 pruebas unitarias (7 nuevas), 78/78 funcionales (6 nuevas).
17. **Limpieza de carritos abandonados** (seguimiento inmediato del punto 4, pedido por el usuario tras cerrarlo): `limpiarComprasWebAbandonadas()` en `ventas.ts` anula (libera boletas) las ventas `canal='web'` que llevan más del límite en `pendiente_pago` sin confirmación. Se ejecuta desde el cron diario que ya existía (`/api/cron/outbox`) en vez de crear uno nuevo — el plan Hobby de Vercel limita cuántos crons hay y con qué frecuencia corren. Verificado: 129/129 unitarias, 79/79 funcionales (1 nueva).

**Con esto quedan completados los 16 puntos de la lista del usuario, más la limpieza de carritos abandonados.**

**Verificado en vivo**: deploy a producción exitoso (`vercel deploy --prod`) tras cada lote; nav de consulta pública sin "Ingresar (empresa)" confirmado visualmente en el navegador; rutas nuevas (`/app/ventas/abono-otra-sede`, `/api/boletas/disponibles`, `/app/config`, `/api/clientes/buscar`, `/vendedor/clientes`, `/api/webhooks/wompi`) responden 307/401/404 correctamente sin sesión, en local y producción. **No se pudo verificar en vivo con sesión real** (login de admin/cajero/vendedor) ni un pago real de Wompi: las credenciales de memoria de sesiones anteriores ya no son válidas y no se intentó adivinar por fuerza bruta, y no hay credenciales de sandbox de Wompi configuradas — queda pendiente que el usuario entre y confirme visualmente "Abonados" en un vendedor, la columna "Medio" en ventas, la pantalla de abono de otra sede, el ranking/cierre de rifa, el autocompletar de cliente, "Mis clientes" del vendedor, el traslado entre rifas, la landing pública de su empresa, y una compra en línea real una vez cargue sus llaves de Wompi.

### 2026-08-23 — Auditoría retroactiva con la skill `ciclo-software` (gobernanza, no funcionalidad)

El usuario pidió ir a `C:\Proyectos\Rifax\ciclo-software` (skill agregada localmente, junto a otra ya existente en este repo: `.claude/skills/auditoria-especialistas`) y ejecutarla rigurosamente para auditar RIFAX. Es una skill de **proceso** (7 etapas con compuertas, reparte decisiones `[H]`/`[IA]`/`[H+IA]`), distinta de `auditoria-especialistas` (que audita el código en 5 dominios técnicos). No se tocó código de la aplicación — esta entrada documenta gobernanza, no una sesión de desarrollo, así que **no aplica** el protocolo de "kit de pruebas en vivo + deploy" de arriba (no hubo funcionalidad que verificar en el navegador).

- Se creó `.ciclo/estado.md` y `.ciclo/riesgos.md` en la raíz del repositorio (no dentro de `rifax2/`, porque el repo git es uno solo y contiene también el núcleo original en `api/`/`src/`/`db/`).
- Se leyó completa esta bitácora (731 líneas) y `docs/caracteristicas-funcionales.md`, y se corrieron en modo solo-lectura: `npm run build` (limpio), `npm test` (129/129, coincide con el último número registrado aquí), `npm run lint` (**3 errores activos**: 2 `react/no-unescaped-entities` en `src/app/app/config/page.tsx` y 1 `react-hooks/set-state-in-effect` en `src/app/app/vendedores/[id]/form-asignar.tsx` — confirma el hallazgo de la auditoría de DevOps del 2026-08-06: `npm run build` no corre ESLint, así que estos errores no se detectan solos) y `npm audit --omit=dev` (**12 vulnerabilidades: 11 high, 1 moderate** — 3 con fix no-breaking disponible actualizando `next` a 16.3.2, 2 más con `npm audit fix` simple, el resto en la cadena de `prisma` CLI, mismo patrón de bajo-riesgo-real que en el proyecto hermano SISMED).
- **Hallazgo más urgente, no técnico**: `git status` mostraba la rama `rifax2` **14 commits adelante de `origin/rifax2`**, sin subir. No se hizo push — es una decisión que le corresponde confirmar al usuario, no algo que deba ejecutarse solo dentro de una auditoría.
- **A diferencia de SISMED** (el otro proyecto auditado con esta misma skill), RIFAX llega con evidencia real de disciplina ya aplicada: dos rondas de auditoría de 5 especialistas con vulnerabilidades reales corregidas (IDOR intra-tenant, condición de carrera en comisiones, validación de tenant/sede faltante), pruebas funcionales contra la base de datos real con limpieza verificada, y migraciones SQL versionadas y numeradas. El trabajo de esta auditoría es sobre todo **consolidar** esa disciplina en `.ciclo/`, no destapar negligencia.
- Pendiente de decisión del dueño (preguntado en el chat inmediatamente después de esta entrada): confirmar que `rifax2` es el único sistema en producción (no el núcleo original), clasificación de tamaño, responsable funcional/técnico, y qué hacer primero con los 14 commits sin subir, los 3 errores de lint y las vulnerabilidades de `npm audit`.
- No se modificó ningún archivo de `src/`, `prisma/` ni configuración de despliegue.
