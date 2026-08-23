# Etapa 1 — Requisitos y contexto

Todo lo que se decide mal aquí se paga multiplicado. Los requisitos **no funcionales**
son los que determinan la arquitectura; si se definen después, se rediseña.

## Preguntas, en orden de impacto

**El problema y la gente**
- ¿Quién es el usuario real y qué tarea concreta reemplaza esto? ¿Cómo lo hace hoy?
- ¿Quién paga, quién usa y quién aprueba? Casi nunca son la misma persona.
- ¿Qué pasa si el proyecto no se hace? Si la respuesta es "nada grave", el alcance
  debe ser mínimo.

**Carga y disponibilidad**
- ¿Cuántos usuarios concurrentes en el pico, y cuándo es el pico?
- ¿Cuánto puede crecer el volumen de datos en dos años?
- ¿Qué pasa si el sistema se cae dos horas? ¿Y dos días? Eso define disponibilidad,
  redundancia y presupuesto. Pide la consecuencia concreta, no un porcentaje
  inventado.
- ¿Hay ventanas críticas de operación (cierre de mes, día de pagos, temporada)?

**Datos y cumplimiento**
- ¿Qué datos personales, reservados o financieros se manejan?
- ¿Qué norma aplica y quién responde por incumplirla?
- ¿Cuánto tiempo hay que conservar la información y qué pasa después?
- ¿Se requiere trazabilidad de quién consultó o modificó qué?

**Integraciones y entorno**
- ¿Con qué sistemas existentes tiene que hablar? ¿Exponen API o toca extraer datos?
- ¿Quién controla esos sistemas y con qué disponibilidad responden?
- ¿Hay restricciones sobre dónde pueden residir los datos?

**Frontera**
- ¿Qué queda explícitamente **fuera** del alcance? Escríbelo; es la pregunta que evita
  más conflictos.
- ¿Cuál es la fecha real y qué la impone (contrato, ley, evento)?
- ¿Cuál es el presupuesto de operación mensual, no solo el de construcción?

## Decisiones

- **[H]** Alcance incluido y excluido.
- **[H]** Nivel de disponibilidad y consecuencia de la caída.
- **[H]** Datos que se van a tratar y marco normativo aplicable.
- **[H]** Fecha y presupuesto (construcción y operación).
- **[H+IA]** Historias de usuario o casos de uso priorizados.
- **[IA]** Redacción de requisitos no funcionales medibles a partir de las respuestas.
- **[IA]** Borrador del registro de riesgos inicial.

## Riesgos típicos de esta etapa

- Requisitos no funcionales ausentes o inventados ("que sea rápido y seguro").
- Alcance definido solo por lo que el sistema *hace*, nunca por lo que *no* hace.
- Integración asumida como disponible sin haber visto la documentación ni las
  credenciales.
- El costo mensual de infraestructura nunca se preguntó y aparece en el mes tres.

## Criterio de salida (compuerta 1)

- [ ] Alcance escrito con exclusiones explícitas
- [ ] Requisitos no funcionales con números: concurrencia, volumen, tiempo de
      respuesta aceptable, disponibilidad objetivo
- [ ] Clasificación de los datos y norma aplicable identificada
- [ ] Lista de integraciones con estado real de cada una (documentada / por confirmar
      / inexistente)
- [ ] Fecha, presupuesto de construcción y presupuesto mensual de operación
- [ ] Riesgos iniciales registrados con dueño
