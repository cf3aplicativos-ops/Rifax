# Etapa 2 — Diseño

El orden interno es de dependencia: arquitectura → modelo de datos → contrato de API
→ modelo de seguridad. No se puede diseñar la API sin saber qué entidades existen, ni
la autorización sin saber qué recursos protege.

## Preguntas, en orden de impacto

**Arquitectura**
- ¿Monolito o servicios separados? Si se eligen servicios, ¿qué justifica la
  complejidad adicional? Por defecto, monolito bien organizado.
- ¿Qué exige el requisito no funcional más duro de la Etapa 1, y la arquitectura lo
  soporta?
- ¿Qué partes van a cambiar más seguido? Ahí van las fronteras.
- ¿Qué se compra o se reutiliza en vez de construirse?

**Modelo de datos**
- ¿Cuál es la entidad central y quién la posee?
- ¿Qué información es histórica e inmutable y cuál es estado mutable? Confundirlas
  destruye la trazabilidad.
- ¿Se borra de verdad o se marca como anulado? En dominios contables y públicos casi
  nunca se borra.
- ¿Qué campos son sensibles y necesitan cifrado o enmascaramiento?

**Contrato de API**
- ¿La API es interna, pública o de integración con terceros?
- ¿Cómo se versiona y qué pasa con los clientes viejos?
- ¿Qué operaciones deben ser idempotentes (reintentables sin duplicar efecto)?
- ¿Qué se pagina, qué se filtra, qué se puede exportar masivamente?

**Seguridad**
- ¿Qué roles existen y qué puede ver o hacer cada uno sobre cada recurso? Hazlo
  tabla, no párrafo.
- ¿La autorización es por rol, por pertenencia al dato, o ambas? La segunda es la que
  se olvida y produce el clásico "cambio el ID en la URL y veo lo del vecino".
- ¿Cómo se autentica? ¿Hay directorio institucional o inicio de sesión federado?
- ¿Qué acciones exigen registro de auditoría inmutable?

## Decisiones

- **[H]** Estilo de arquitectura y dónde residen los datos.
- **[H]** Matriz de roles y permisos (la IA la propone, el humano la valida: solo él
  sabe cómo funciona la entidad).
- **[H]** Qué se construye y qué se compra o reutiliza.
- **[H]** Política de retención y borrado.
- **[H+IA]** Modelo de datos y contrato de API.
- **[IA]** Diagramas, esquema de tablas, especificación de endpoints, ADR de cada
  decisión estructural con las alternativas descartadas.

## Riesgos típicos de esta etapa

- Autorización solo por rol, sin verificar pertenencia del recurso.
- Modelo de datos sin fecha de creación, autor ni versión: después no hay forma de
  auditar.
- API diseñada al mismo tiempo que el frontend, quedando acoplada a una pantalla.
- Elegir microservicios por moda y multiplicar el costo operativo de la Etapa 7.

## Criterio de salida (compuerta 2)

- [ ] Diagrama de arquitectura con las fronteras y el flujo de datos
- [ ] Modelo de datos con entidades, relaciones y restricciones de integridad
- [ ] Contrato de API acordado y versionado
- [ ] Matriz de roles y permisos validada por el responsable funcional
- [ ] Clasificación de datos sensibles y decisión de cifrado
- [ ] ADR escritos para cada decisión estructural
