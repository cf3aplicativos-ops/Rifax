# RIFAX — Características funcionales

> Este documento describe **qué puede hacer** la plataforma RIFAX, en lenguaje
> sencillo y orientado a negocio. No incluye detalles técnicos de
> implementación (lenguajes, bases de datos, servidores, etc.).

RIFAX es una plataforma para que **varias empresas independientes** gestionen
sus rifas, vendedores, ventas y cobros, cada una con su propia información
totalmente separada de las demás, y con un **dueño de la plataforma**
(super-administrador) que administra a todas esas empresas como clientes.

Hay tres tipos de acceso con usuario y contraseña, más un portal del cliente
que no requiere cuenta:

- **Super-administrador**: dueño de la plataforma, administra a las empresas
  clientes.
- **Empresa (administrador y su equipo)**: cada empresa que usa RIFAX para
  vender sus rifas.
- **Vendedor**: persona que vende boletas para una empresa, con acceso a un
  portal simplificado pensado para el celular.
- **Cliente (comprador)**: no necesita usuario ni contraseña; consulta su
  compra con su documento y teléfono.

### Índice

1. [Sitio público](#1-sitio-público)
2. [Portal del cliente (comprador de boletas)](#2-portal-del-cliente-comprador-de-boletas)
3. [Portal de la empresa (administradores, gerentes, cajeros)](#3-portal-de-la-empresa-administradores-gerentes-cajeros)
   - [Gestión de rifas](#gestión-de-rifas)
     - [Carga masiva (arranque inicial de una rifa que ya se vendía por fuera del sistema)](#carga-masiva-arranque-inicial-de-una-rifa-que-ya-se-vendía-por-fuera-del-sistema)
   - [Vendedores](#vendedores)
   - [Ventas](#ventas)
   - [Traspaso de boletas entre vendedores o puntos de venta](#traspaso-de-boletas-entre-vendedores-o-puntos-de-venta)
   - [Cartera (cuentas por cobrar)](#cartera-cuentas-por-cobrar)
   - [Conciliación con IA (plan Corporativo)](#conciliación-con-ia-plan-corporativo)
   - [Comisiones](#comisiones)
   - [Reportes](#reportes)
4. [Portal del vendedor (pensado para el celular)](#4-portal-del-vendedor-pensado-para-el-celular)
5. [Panel del super-administrador (dueño de la plataforma)](#5-panel-del-super-administrador-dueño-de-la-plataforma)
6. [Planes comerciales](#6-planes-comerciales)
7. [Seguridad y confianza (en términos simples)](#7-seguridad-y-confianza-en-términos-simples)

---

## 1. Sitio público

- **Página de inicio**: presenta la plataforma, sus características, los
  planes disponibles y sus precios, un carrusel de fotos y un formulario de
  contacto para empresas interesadas en contratar RIFAX.

## 2. Portal del cliente (comprador de boletas)

No requiere crear una cuenta ni recordar ninguna contraseña.

- **Consulta de estado de cuenta**: el comprador se identifica solo con su
  **número de documento y su número de teléfono** (los dos deben coincidir
  con lo que quedó registrado en la venta). Con eso puede ver:
  - Todas sus compras y los números de boleta que le pertenecen.
  - Cuánto ha pagado y cuánto saldo le queda pendiente por cada compra.
  - Si alguno de sus números resultó ganador en algún sorteo ya realizado.
  - Puede imprimir o descargar ese resultado como comprobante.
- Es una consulta de **solo lectura**: el cliente ve su propia información,
  nunca la de otros compradores, y no puede modificar nada desde ahí (para
  registrar un pago o un cambio debe hacerlo el vendedor o la empresa).

---

## 3. Portal de la empresa (administradores, gerentes, cajeros)

### Panel principal
Un resumen visual del negocio: total recaudado, cartera pendiente, ventas
realizadas, rifas activas, boletas vendidas frente a disponibles, recaudo por
sede, cartera vencida por antigüedad, y un ranking de los mejores vendedores.
Se puede imprimir como informe.

### Gestión de rifas
- Crear una rifa indicando el rango de números, el precio de cada boleta, la
  lotería de referencia y la fecha del sorteo.
- Publicar la rifa cuando esté lista (esto habilita todas sus boletas para la
  venta).
- Subir el **logo de la rifa** y una **imagen personalizada de la boleta**
  (la que se imprime en el recibo del comprador).
- Definir **premios**, incluyendo premios que se sortean antes del premio
  principal ("premios anticipados").
- Repartir la venta de una misma rifa entre **varias sedes** (rifas
  compartidas entre puntos de venta) — opcional: si cada sede prefiere manejar
  la suya, simplemente no se marca esa opción, y cada una crea su propia rifa
  con su propio rango de números, premio mayor y premios anticipados,
  totalmente independiente de las demás.
- **Realizar el sorteo** de dos formas:
  - *Verificable en el sistema*: se genera un número al azar de forma que
    cualquiera puede comprobar después que el resultado no fue manipulado.
  - *Con lotería externa*: se digita el número ganador que salió en una
    lotería real, adjuntando la evidencia (por ejemplo un enlace).
- Después del sorteo, el sistema indica automáticamente si la boleta
  ganadora fue vendida y a quién, y permite hacer seguimiento a la entrega
  del premio (pendiente, contactado, entregado, no reclamado).
- **Editar los datos de la rifa** (nombre, descripción, lotería, precio de
  la boleta, fechas de apertura/cierre/sorteo) en cualquier momento antes de
  que se sortee. La sede, la cantidad de dígitos y si es compartida no se
  pueden cambiar una vez creada, porque ya determinaron las boletas
  generadas.

#### Carga masiva (arranque inicial de una rifa que ya se vendía por fuera del sistema)

Pensada para cuando una empresa empieza a usar RIFAX a mitad de una rifa que
ya llevaba tiempo vendiéndose en papel o por fuera del sistema, y quiere
dejar todo ese historial registrado sin digitarlo venta por venta.

1. **Descargar las plantillas** (un archivo de ejemplo para vendedores y
   otro para ventas, más una guía de instrucciones).
2. **Importar los vendedores**: se sube el archivo con los vendedores que ya
   existían, con su nombre, documento, teléfono y comisión. Los que ya
   estén registrados con el mismo documento se omiten automáticamente, para
   poder repetir la carga sin duplicar nada.
3. **Importar las ventas ya realizadas**: se sube el archivo con las boletas
   que ya se habían vendido, sus compradores y lo que ya habían abonado. El
   sistema, de una sola vez:
   - Crea los clientes que no existían todavía.
   - Reserva esas boletas para que no puedan venderse de nuevo por error.
   - Registra los pagos (abonos) ya recibidos, con el saldo pendiente
     correspondiente.
4. Al terminar cada carga, se muestra un resumen: cuántas filas se
   procesaron, cuántas se importaron con éxito, cuántas ya existían (y por
   eso se omitieron) y el detalle de cualquier fila con error, para poder
   corregirla y volver a intentar solo esa parte.

### Sedes (puntos de venta)
Crear y administrar las sedes de la empresa — pueden ser 1, 2 o muchas más,
según lo que autorice el plan — (hasta el número permitido por su plan),
**editar su nombre, dirección y teléfono** en cualquier momento, activarlas o
desactivarlas, y ver el desempeño individual de cada una (recaudo, cartera,
ventas, ranking de vendedores propio).

**Un administrador propio para cada sede**: al crear una sede se puede marcar
la opción de crear también su administrador — queda con el mismo rol de
administrador, pero acotado solo a esa sede, gestionando sus propias rifas,
ventas y cartera de forma completamente independiente de las demás (todas
viven en la misma base de datos de la empresa). El administrador general que
creó la empresa sigue viendo todas las sedes.

### Vendedores
- Registrar vendedores, con su porcentaje de comisión y un cupo máximo de
  boletas, y asignarlos a una **sede** específica o dejarlos sin sede fija
  (lo que significa que atienden **todas las sedes**).
- El listado y la ficha de cada vendedor siempre muestran a qué sede
  pertenece, o "Todas las sedes" si no tiene una fija.
- Asignarles **talonarios** (rangos de boletas) de las rifas activas. Si el
  vendedor tiene una sede fija, **solo se le pueden asignar boletas de esa
  sede** (en rifas compartidas entre varias sedes, se valida boleta por
  boleta); si está asignado a todas las sedes, se le puede asignar cualquier
  rango de cualquier sede.
- Cerrar talonarios, liberando las boletas que no se alcanzaron a vender.
- Activar, suspender o inactivar vendedores.
- **Editar los datos de un vendedor** (nombre, documento, teléfono, correo,
  sede, comisión, cupo máximo) en cualquier momento — solo puede hacerlo
  quien tenga permiso para ver sus datos personales.
- Crear el acceso al portal móvil para cada vendedor.
- Los datos personales sensibles de los vendedores solo los ve quien tenga
  el permiso correspondiente.

### Ventas
- Registrar una venta eligiendo la rifa, los números de boleta y los datos
  del comprador.
- **Buscar una boleta puntual por su número** para saber si está disponible,
  vendida, o asignada a un vendedor o a un punto de venta específico.
- Tanto el listado como el detalle de cada venta muestran **quién la
  realizó**: el nombre del vendedor, o "Punto de venta" (con el nombre de
  la sede) si se vendió directamente sin un vendedor asignado.
- Ver el detalle de cada venta: boletas compradas, total, abonado, saldo
  pendiente e historial de pagos.
- Registrar abonos (pagos parciales) o anular una venta (lo que libera las
  boletas para que puedan venderse de nuevo).
- Generar un **recibo imprimible** de cada venta, con el logo correspondiente.
- Al agregar números a una venta, si la rifa tiene una **imagen de boleta** cargada, cada número se muestra
  sobre esa imagen en vez de un recuadro liso genérico — para que se vea como una boleta real.

### Traspaso de boletas entre vendedores o puntos de venta

> **Única excepción al entorno propio de cada sede.** Una empresa puede tener
> 1, 2 o muchas sedes (sin límite fijo en el sistema, solo el que autorice su
> plan), y cada una puede estar en un lugar distinto con su propio día a día:
> un usuario acotado a una sede solo ve las rifas, ventas y cartera de **esa**
> sede. Los **traspasos son la única excepción**: la búsqueda de una boleta
> puntual consulta **toda la empresa**, sin importar a qué sede pertenezca
> quien busca.

**¿Quién es el "dueño" de una boleta disponible (aún no vendida)?**
- Si está dentro de un talonario asignado a un vendedor → es **de ese
  vendedor**.
- Si no está en ningún talonario → es **del punto de venta** (la sede).

**Paso a paso:**
1. Alguien (vendedor o punto de venta) busca por número una boleta que
   necesita vender pero que no es suya.
2. El sistema responde con uno de estos resultados:
   - **Vendida**: no se puede pedir.
   - **Ya es tuya**: se puede vender directamente, sin pedir nada.
   - **Asignada al vendedor [nombre]**: hay que solicitarla.
   - **Disponible en el punto de venta**: hay que solicitarla.
3. Si no es suya y sigue disponible, aparece el botón **Solicitar**. Solo
   puede existir **una solicitud pendiente a la vez** por boleta.
4. La solicitud le llega a quien la tiene:
   - Si es de un vendedor → le llega únicamente a ese vendedor.
   - Si es del punto de venta → le llega a cualquier administrador o
     gerente de la empresa (no hace falta que sea de esa sede en
     particular).
5. El dueño la revisa en su bandeja de **Traspasos** y decide:
   - **Aprobar**: la boleta pasa a ser del solicitante. Antes de mover
     nada, el sistema comprueba que siga disponible (por si alguien la
     vendió mientras tanto); si ya se vendió, la solicitud se rechaza sola
     con ese motivo. Desde la aprobación, la comisión de la futura venta de
     esa boleta es del nuevo dueño.
   - **Rechazar**: puede indicar un motivo opcional. La boleta no se mueve
     y el solicitante ve el rechazo en su bandeja de "Enviadas".
6. Toda solicitud, aprobación o rechazo queda registrado en el historial de
   auditoría de ambas partes.

**Avisos automáticos:** mientras se tiene la aplicación abierta, aparece un
aviso sonoro y una tarjeta emergente en tres momentos, sin tener que
refrescar la página: al dueño de una boleta cuando le llega una solicitud
nueva; y a quien solicitó, tanto si su solicitud es **aprobada** (la boleta
ya es suya) como si es **rechazada** (mostrando el motivo, si el dueño lo
indicó).

### Cartera (cuentas por cobrar)
Lista de ventas con saldo pendiente, clasificadas automáticamente por
antigüedad de mora (al día, mora temprana, media y avanzada), con el total
pendiente por cada categoría.

### Conciliación con IA (plan Corporativo)
Ayuda a identificar, con inteligencia artificial, a qué venta pendiente
corresponde cada pago recibido, en tres modalidades:

- **Extracto bancario** (recomendada): se pega el listado de movimientos de
  la cuenta bancaria o de una billetera digital (fecha, descripción y
  monto), o se **sube un archivo CSV** del extracto (si se tiene en Excel,
  se guarda primero como CSV). Los movimientos se reconocen por columna sin
  IA; la IA solo compara cada movimiento contra la cartera pendiente de
  toda la empresa.
- **Reporte de vendedor**: se pega el texto que envió un vendedor (por
  ejemplo, copiado de WhatsApp) contando lo que recaudó. La IA identifica
  cada pago mencionado y lo compara contra la cartera pendiente de ese
  vendedor en particular.
- **Comprobantes de pago (imagen)**: se suben fotos o capturas de
  comprobantes de transferencia. La IA lee el monto y el remitente de cada
  una.

En los tres casos, la IA **solo sugiere**: para cada pago muestra la venta
que probablemente le corresponde, con un porcentaje de confianza y una
breve explicación. **Nada se registra automáticamente.** Un administrador
revisa la lista, marca qué coincidencias son correctas y solo al confirmar
esa selección se registran los abonos correspondientes — igual que si se
hubieran registrado a mano uno por uno. Esta función requiere que la
plataforma tenga configurado un proveedor de inteligencia artificial.

### Comisiones
Cálculo automático de la comisión de cada vendedor sobre lo que ha
recaudado, con lo ya pagado y lo pendiente. Permite liquidar (pagar) la
comisión de un vendedor, o de todos a la vez (esta última opción está
disponible en el plan Corporativo). Además del consolidado por vendedor,
hay un **informe detallado aparte**: una fila por cada venta con comisión,
con el número de cada boleta — para saber exactamente de qué venta sale la
comisión de cada vendedor. Los dos informes se descargan por separado.

### Reportes
Reportes gerenciales de recaudo, facturación, cartera y avance de venta por
cada rifa (cuántas boletas están pagadas, reservadas o disponibles), con
descarga en archivos compatibles con Excel. Incluye una tabla de **ventas
por vendedor y sede** (cuántas ventas, cuánto facturó y cuánto ha recaudado
cada uno), también descargable, y una herramienta para **verificar que el
historial de acciones de la empresa no haya sido alterado**. El listado de
ventas incluye el **número de cada boleta** vendida y una columna de
**observaciones** que anota, cuando aplica, si una boleta llegó a manos de
quien la vendió por un traspaso aprobado (de qué vendedor a qué vendedor).

### Notificaciones
Cola de mensajes salientes de la empresa (por ejemplo avisos), con su
estado (pendiente, en proceso, enviado, fallido) y un botón para procesarlos
manualmente. La plataforma también los procesa automáticamente una vez al
día.

### Configuración
- **Marca de la empresa**: logo, imagen de fondo y color propio, que se ven
  reflejados en el portal y en los recibos.
- **Listas desplegables personalizables**: canales de venta, orígenes de los
  abonos, canales de mensajería y loterías disponibles, según lo que use
  cada empresa.

### Usuarios internos y perfil
- Crear usuarios internos con un rol y permisos específicos, y asignarlos a
  una sede.
- Cambiar el rol o el estado de cualquier usuario, y restablecerle la
  contraseña (se le genera una temporal).
- Editar cualquier campo de un usuario ya creado: nombre, correo, teléfono,
  rol, sede, permisos personalizados y, si hace falta, también su
  contraseña — el campo se muestra siempre vacío con un marcador
  (••••••••), sin revelar la contraseña real; si se deja en blanco no
  cambia, y una nueva la reemplaza de inmediato y se envía por correo a la
  cuenta afectada, igual que con "¿Olvidaste tu contraseña?".
- Lo mismo aplica a un vendedor que ya tiene acceso al portal móvil: desde
  su ficha se le puede cambiar el correo de acceso y/o la contraseña, con
  el mismo marcador, el mismo criterio de "en blanco no cambia" y el mismo
  aviso automático por correo.
- Cada usuario puede ver y editar su propio perfil, y cambiar su propia
  contraseña.
- **Sedes independientes, un administrador general de solo consulta**: cuando
  una empresa tiene varias sedes, cada una opera su día a día por separado
  (rifas, ventas, cartera, vendedores), todo dentro de la misma base de datos
  de la empresa. El rol **"auditor"**, asignado a un usuario sin sede fija,
  ve el avance de **todas** las sedes (panel principal, reportes y cartera
  desglosados por sede) sin poder crear, editar, anular ni publicar nada —
  solo trae permisos de consulta.
- **La primera vez que un administrador o un vendedor ingresa** (cuenta
  recién creada, o después de un restablecimiento de contraseña), el
  sistema lo obliga a definir una contraseña propia antes de continuar —
  igual que cuando se usa la opción de "olvidé mi contraseña".
- **"¿Olvidaste tu contraseña?" es automático**: al escribir el correo
  registrado, si coincide con una cuenta, el sistema genera una contraseña
  temporal y la envía de inmediato por correo a esa misma dirección
  registrada (no a otra) — sin esperar a que un administrador la procese
  manualmente. La respuesta en pantalla es siempre genérica, para no
  revelar si el correo existe o no.
- **Instalación como app**: la primera vez que se entra desde un
  computador, portátil, tablet o celular, aparece un aviso para instalar
  RIFAX como acceso directo en ese dispositivo (queda como una app, sin
  tener que abrir el navegador cada vez). Por seguridad, ningún navegador
  permite instalar nada sin que la persona lo confirme con un toque; en
  iPhone/iPad, al no existir esa opción automática, se muestran las
  instrucciones para agregarlo manualmente desde el botón de compartir de
  Safari.

---

## 4. Portal del vendedor (pensado para el celular)

- **Inicio**: resumen de los talonarios activos, boletas disponibles,
  recaudo propio y accesos rápidos a registrar una venta, ver comisiones y
  gestionar traspasos.
- **Registrar venta**: igual que en el portal de la empresa, pero el
  vendedor solo ve sus propias rifas y boletas asignadas.
- **Mis comisiones**: cuánto ha recaudado, cuánto le corresponde de
  comisión, lo ya pagado y lo pendiente.
- **Traspasos**: solicitar boletas de otro vendedor o del punto de venta, y
  autorizar o rechazar las solicitudes que otros le hagan a él.

---

## 5. Panel del super-administrador (dueño de la plataforma)

### Empresas clientes
- Ver el listado completo de empresas: estado (activa, suspendida,
  inactiva), plan contratado, sedes y usuarios usados frente a los
  autorizados, mora pendiente y próxima fecha de pago.
- Dar de alta una nueva empresa: nombre, logo, plan, fecha de inicio,
  periodicidad de pago (con la que se genera automáticamente su calendario
  de vencimientos) y el usuario administrador inicial.
- Editar cualquier campo de una empresa ya creada: nombre, identificador,
  cupos de sedes/usuarios y vigencia (si cambia la periodicidad o la fecha
  de inicio, el calendario de vencimientos se regenera).
- Cambiar el plan de una empresa o ampliar su número de sedes autorizadas.
- Cambiar el estado de una empresa (al suspenderla o inactivarla, se cierra
  automáticamente el acceso de todos sus usuarios).
- Eliminar por completo una empresa y todos sus datos, mediante un proceso
  de confirmación en varios pasos para evitar errores.
- Recibe un aviso emergente cuando una o más empresas están a 5 días o
  menos de su fecha de vencimiento (o ya vencidas), calculada desde la
  fecha de inicio del contrato de cada una.

### Facturación de la plataforma hacia sus empresas clientes
- Configurar los tres precios del plan Básico (mensual, semestral, anual) y
  el número de sedes incluidas en cada plan (Básico y Corporativo); el
  precio del plan Corporativo se cotiza a la medida (texto libre).
- Generar facturas de forma individual o masiva por periodo (el monto del
  plan Básico se calcula según la periodicidad de pago de cada empresa).
- Marcar facturas como pagadas (lo que extiende automáticamente la fecha de
  vencimiento de la empresa) o anularlas.
- Ver el historial completo de facturación y la mora acumulada por empresa.

### Recuperación de acceso
La opción "¿Olvidaste tu contraseña?" de la pantalla de inicio de sesión resuelve las solicitudes
sola: valida el correo contra la cuenta registrada y envía la contraseña
temporal por correo de inmediato, sin intervención del super-administrador.

### Apariencia pública de la plataforma
Administrar la imagen de fondo de la pantalla de inicio de sesión y el
carrusel de fotos/textos que se muestra en la página pública de inicio.

---

## 6. Planes comerciales

RIFAX ofrece dos categorías de plan para las empresas clientes (sedes y
precios configurables por el super-administrador; valores por defecto):

- **Básico**: 1 sede, usuarios ilimitados. Precio mensual $180.000,
  semestral $140.000/mes, anual $120.000/mes.
- **Corporativo**: 2 sedes, usuarios ilimitados, liquidación masiva de
  comisiones, y espacio reservado para integraciones adicionales (pasarela
  de pagos, mensajería por WhatsApp/SMS, soporte prioritario). Precio a
  medida, según lo que se acuerde con cada cliente.

---

## 7. Seguridad y confianza (en términos simples)

- Cada empresa solo puede ver y administrar su propia información; nunca la
  de otra empresa.
- Cada acción importante que se realiza en el sistema (crear, modificar,
  eliminar) queda registrada en un historial que **no se puede alterar sin
  que quede evidencia**, y existe una función para comprobar que ese
  historial sigue intacto. Solo el dueño de la plataforma puede depurar
  registros de más de un año de antigüedad, y esa depuración queda
  documentada (qué se quitó, cuándo y quién lo hizo) — nunca desaparece sin
  dejar rastro.
- Antes de vender una boleta, el sistema verifica en el momento que nadie
  más la esté vendiendo al mismo tiempo, evitando la venta duplicada de un
  mismo número.
- El acceso de cada persona está limitado a lo que su rol y permisos le
  autorizan a ver o hacer.
- Las contraseñas nunca se guardan ni se muestran en texto plano, y toda
  contraseña temporal obliga a definir una nueva en el primer ingreso.
