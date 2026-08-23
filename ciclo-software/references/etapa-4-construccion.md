# Etapa 4 — Construcción

Se construye por **rebanadas verticales** de funcionalidad, no por capas completas.
Una rebanada atraviesa datos, lógica, API e interfaz y le sirve a un usuario real. Es
la única forma de descubrir temprano que el diseño estaba mal.

Esta es la etapa donde la IA aporta más velocidad — y justamente por eso es donde más
fácil se pierde el control. La regla: la IA escribe, el humano decide qué se acepta.

## Preguntas antes de cada rebanada

- ¿Cuál es la rebanada más delgada que ya le sirve a alguien?
- ¿Esta funcionalidad se puede probar sin intervención manual? Si no, rediseñarla.
- ¿Esta migración es reversible? ¿Qué pasa si falla a la mitad?
- ¿Qué estoy asumiendo aquí que nadie me confirmó? Anótalo como supuesto abierto.
- ¿Este código repite algo que ya existe en el proyecto?

## Cómo trabajan humano e IA aquí

- **[H]** Prioridad de las rebanadas y criterio de aceptación de cada una.
- **[H]** Aprobación de cambios al modelo de datos y al contrato de API ya acordados.
  Si la construcción exige cambiarlos, se vuelve a la Etapa 2 para esa pieza; no se
  cambia de facto en el código.
- **[H]** Incorporación de cualquier dependencia nueva de terceros: alguien tiene que
  mirar licencia, mantenimiento y a quién le confía datos.
- **[IA]** Implementación, pruebas unitarias y de integración escritas junto al
  código, migraciones versionadas, documentación de la API.
- **[H+IA]** Revisión de código. La IA explica qué hizo y qué quedó frágil; el humano
  revisa lo que toca dinero, permisos o datos personales, línea por línea.

La IA debe señalar por iniciativa propia cuando algo quedó incompleto o frágil,
aunque nadie pregunte. "Funciona, pero no maneja el caso de X" vale más que un
entregable que parece terminado.

## Riesgos típicos de esta etapa

- Código generado en volumen que nadie leyó y que nadie sabe mantener.
- Pruebas escritas al final, o pruebas que solo confirman el camino feliz.
- El contrato de API se va cambiando en silencio y el frontend se acopla a versiones
  distintas.
- Migraciones editadas después de aplicadas, dejando ambientes desincronizados.
- Dependencias agregadas por conveniencia sin revisar su estado de mantenimiento.

## Criterio de salida (compuerta 4)

- [ ] Todas las rebanadas comprometidas cumplen su criterio de aceptación
- [ ] Pruebas unitarias y de integración pasando en la canalización automática
- [ ] Migraciones aplicadas y reversibles en los tres ambientes
- [ ] Revisión humana hecha sobre el código de autorización, dinero y datos sensibles
- [ ] Supuestos abiertos confirmados o convertidos en riesgos registrados
- [ ] Documentación de la API actualizada respecto a lo construido
