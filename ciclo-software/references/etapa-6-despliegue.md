# Etapa 6 — Despliegue

La observabilidad se configura **antes** del go-live, no después del primer
incidente. El objetivo es enterarse de que algo se cayó antes que los usuarios.

## Preguntas, en orden de impacto

**Reversibilidad**
- ¿Cómo se revierte un despliegue malo y en cuánto tiempo? Pruébalo.
- ¿Los cambios de base de datos son compatibles hacia atrás durante la ventana de
  despliegue?
- ¿Quién autoriza salir a producción y en qué horario?

**Continuidad**
- ¿Cuándo fue la última vez que se **restauró** un respaldo de verdad? Un respaldo no
  probado no es un respaldo.
- ¿Cuánta información se puede perder como máximo, y cuánto puede tardar la
  recuperación? Esos dos números salen de la Etapa 1.
- ¿Dónde están los respaldos? Si están en el mismo lugar que el sistema, no protegen
  de nada.

**Operabilidad**
- ¿Quién se entera del incidente, por qué canal, a las tres de la mañana?
- ¿Qué alerta significa "levantarse" y cuál "mirar mañana"? Alertas que suenan por
  todo se terminan ignorando.
- ¿Se puede seguir el rastro de una petición desde la interfaz hasta la base de
  datos?
- ¿Quién renueva certificados y dominios, y qué pasa si esa persona no está?

## Decisiones

- **[H]** Fecha y ventana del despliegue, y quién lo autoriza.
- **[H]** Proveedor de infraestructura y costo mensual aceptado.
- **[H]** Titularidad de dominios, certificados y cuentas: deben quedar a nombre de
  la organización, no del proveedor ni de una persona.
- **[H]** Quién atiende incidentes y en qué horario.
- **[IA]** Aprovisionamiento de infraestructura, configuración de red, DNS,
  certificados, respaldos automáticos, registros, métricas, alertas, tableros,
  despliegue automatizado y plan de reversión.
- **[H+IA]** Ensayo de restauración de respaldo y de reversión de despliegue.

## Riesgos típicos de esta etapa

- Dominio o cuenta de nube a nombre del contratista: al terminar el contrato, la
  entidad no controla su propio sistema. Este es un desastre frecuente y evitable.
- Respaldos configurados pero nunca restaurados.
- Sin plan de reversión: el primer despliegue malo se resuelve improvisando.
- Alertas que llegan a un correo que nadie revisa.
- Cuota de un plan gratuito agotada sin aviso: el proveedor suspende el servicio y
  la primera señal es la caída, no la alerta.

## Criterio de salida (compuerta 6)

- [ ] Despliegue automatizado y reversión probada al menos una vez
- [ ] Respaldos automáticos y **restauración probada** con fecha registrada
- [ ] Registros, métricas y alertas activas antes de la salida
- [ ] Titularidad de dominios, certificados y cuentas en cabeza de la organización
- [ ] Contactos y canal de incidentes definidos
- [ ] Costo mensual real medido, no estimado
- [ ] Límites del plan de cada proveedor identificados (transferencia, cómputo,
      almacenamiento) con alarma por debajo del tope y destinatario que la revisa
