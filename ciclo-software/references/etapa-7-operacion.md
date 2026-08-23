# Etapa 7 — Operación y entrega

Esta etapa no termina. Y es la que casi nadie cotiza, por eso los sistemas se pudren:
cambian los requisitos, aparecen fallas, se actualizan los sistemas operativos,
cambian las API de terceros y una dependencia que nadie tocó en seis meses deja de
funcionar.

## Preguntas, en orden de impacto

**Sostenibilidad**
- ¿Quién opera el sistema cuando termine el contrato, y está documentado **para esa
  persona**, no para quien lo construyó?
- ¿Cuánto cuesta al mes y cómo escala ese costo con los usuarios?
- ¿Quién actualiza dependencias y con qué frecuencia? Sin dueño, no ocurre.
- ¿Hay un acuerdo de nivel de servicio escrito? ¿Es cumplible con el equipo real?

**Salud del sistema**
- ¿Qué métrica dice si el sistema está cumpliendo su propósito, no solo si está
  encendido? Un sistema disponible que nadie usa está fallando.
- ¿Cuáles son las tres fallas más frecuentes del último mes y qué patrón comparten?
- ¿Qué parte del código concentra los errores?

**Evolución**
- ¿Cómo entra una solicitud de cambio y quién la prioriza?
- ¿Qué cambios exigen volver a la Etapa 2? Todo cambio estructural lo exige.
- ¿Qué deuda técnica se aceptó en las compuertas anteriores y cuándo vence?

## Decisiones

- **[H]** Modelo de soporte, horario y responsable.
- **[H]** Presupuesto de mantenimiento y de infraestructura del año siguiente.
- **[H]** Priorización de la deuda técnica vigente.
- **[IA]** Tableros de uso y errores, informes periódicos, propuestas de
  actualización de dependencias, análisis de causa raíz de incidentes,
  documentación de operación y manuales.
- **[H+IA]** Transferencia de conocimiento: la IA redacta y organiza; el humano
  verifica que otra persona efectivamente pueda operar con eso en la mano.

## Riesgos típicos de esta etapa

- Conocimiento concentrado en una persona o en un hilo de chat.
- Deuda técnica aceptada en compuertas anteriores que nunca se revisa.
- Costos de nube creciendo sin que nadie los mire hasta la factura.
- Dependencias sin actualizar por miedo a romper algo, hasta que la vulnerabilidad
  obliga a hacerlo con afán.

## Criterio de cierre (compuerta 7 — entrega)

- [ ] Documentación de operación probada por alguien externo al desarrollo
- [ ] Accesos y titularidades transferidos a la organización
- [ ] Tablero de salud del sistema y métricas de propósito en funcionamiento
- [ ] Deuda técnica vigente listada con dueño y vencimiento
- [ ] Presupuesto de operación del siguiente periodo aprobado
- [ ] Responsable de soporte definido y capacitado
