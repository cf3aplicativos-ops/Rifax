# Etapa 5 — Endurecimiento

Aquí se asume mala fe y mala suerte: usuarios hostiles, entradas absurdas, redes
caídas, terceros que no responden. Ojo: la seguridad no empieza en esta etapa, se
**verifica** en esta etapa. Si se dejó toda para acá, ya hubo un error de proceso.

## Preguntas, en orden de impacto

**Entradas y abuso**
- ¿Qué pasa si mando esto vacío, gigante, con caracteres raros, o con el ID de otro
  usuario? La última es la prueba que más hallazgos produce.
- ¿Un usuario autenticado puede acceder a datos de otro cambiando un parámetro?
- ¿Hay límite de intentos de inicio de sesión y de peticiones por cliente?
- ¿Qué pasa si suben un archivo de 2 GB, o un archivo que dice ser imagen y no lo es?

**Exposición**
- ¿Los mensajes de error revelan estructura interna, rutas o consultas?
- ¿Qué campos sensibles están apareciendo en los registros de la aplicación?
- ¿Qué queda expuesto a internet que debería estar en red privada?
- ¿Las dependencias tienen vulnerabilidades conocidas hoy?

**Carga y degradación**
- ¿La prueba de carga usa los números de la Etapa 1 o unos inventados?
- ¿Qué se rompe primero cuando el sistema se satura? ¿Falla de forma controlada o se
  cae completo?
- ¿Qué pasa si el tercero del que dependemos tarda 30 segundos en responder?
- ¿Hay reintentos? ¿Son idempotentes o duplican efectos?

## Decisiones

- **[H]** Nivel de riesgo aceptable y qué hallazgos se corrigen antes de salir a
  producción y cuáles quedan como deuda con fecha.
- **[H]** Autorizar la prueba de carga y de penetración sobre los ambientes.
- **[IA]** Pruebas de entradas maliciosas, pruebas de extremo a extremo, revisión de
  dependencias, prueba de carga, informe de hallazgos priorizado por impacto.
- **[H+IA]** Verificación de la matriz de permisos: probar cada rol contra cada
  recurso, incluyendo los intentos que deben fallar.

## Riesgos típicos de esta etapa

- Probar solo que lo permitido funciona, y nunca que lo prohibido falla.
- Prueba de carga contra una base de datos vacía: no prueba nada.
- Corregir el hallazgo puntual sin corregir el patrón que lo produjo en otras diez
  partes del código.
- Datos personales quedando en los registros de la aplicación de forma permanente.

## Criterio de salida (compuerta 5)

- [ ] Validación de entradas y protección contra inyección, XSS y CSRF verificada
- [ ] Matriz de permisos probada, incluyendo accesos que deben ser denegados
- [ ] Prueba de carga ejecutada con los números reales de la Etapa 1
- [ ] Comportamiento ante saturación y ante caída de terceros: conocido y controlado
- [ ] Dependencias sin vulnerabilidades críticas conocidas
- [ ] Hallazgos abiertos aceptados formalmente por el responsable, con fecha
