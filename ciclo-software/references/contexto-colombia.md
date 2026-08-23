# Contexto: sector público colombiano

Lee este archivo cuando el sistema sea para una entidad pública colombiana o maneje
datos de ciudadanos. No es papeleo: estas obligaciones cambian decisiones de diseño y
de arquitectura, y varias de ellas son las que hacen fracasar la entrega final.

Nota: verifica la vigencia de cualquier norma antes de afirmarla en un documento
formal — la regulación cambia y estas notas son orientación, no concepto jurídico.

## Datos personales (Ley 1581 y su reglamentación)

Impacta el diseño, no solo el aviso de privacidad:
- Finalidad declarada: no se pueden recolectar campos "por si acaso". Cada campo del
  modelo de datos debe tener una razón.
- Autorización del titular: hay que poder demostrar cuándo y cómo se otorgó, lo que
  implica guardarla con marca de tiempo y versión del aviso.
- Datos sensibles (salud, biométricos, orientación, afiliación) exigen tratamiento
  reforzado: cifrado, acceso restringido y registro de consultas.
- Derechos del titular (consultar, actualizar, rectificar, suprimir): tiene que
  existir un flujo real para atenderlos, con tiempos.
- Bases de datos con información personal pueden requerir registro ante la autoridad
  de protección de datos.

Pregunta de diseño derivada: **¿el modelo permite borrar o anonimizar a una persona
sin romper la integridad contable o histórica?** Resuélvelo en la Etapa 2.

## Gestión documental y archivo (Ley 594 y normativa del AGN)

- Los documentos electrónicos que soportan actos administrativos tienen tiempos de
  retención y disposición final definidos por tablas de retención documental.
- Se exige trazabilidad e integridad: quién produjo el documento, cuándo, y prueba de
  que no fue alterado.
- Migrar o dar de baja información no es decisión técnica, es decisión archivística.

Pregunta de diseño derivada: **¿qué es documento de archivo dentro del sistema y qué
es dato operativo?** Reciben tratamiento distinto.

## Contratación y entrega

- Lo que quede en el pliego y en la propuesta es el alcance exigible. Las
  exclusiones de la Etapa 1 deben estar ahí, no solo en el acta interna.
- Los entregables suelen incluir código fuente, documentación técnica y de usuario,
  manuales de operación y capacitación. Planéalos desde la Etapa 1, no al final.
- Supervisión e interventoría revisan contra entregables, no contra intención.
- **Titularidad**: dominios, cuentas de nube, licencias y repositorios deben quedar a
  nombre de la entidad. Es el punto donde más contratos terminan mal.
- Transferencia de conocimiento y período de garantía: defínelos antes de construir.

## Interoperabilidad y política digital

Según la entidad y el sistema, pueden aplicar lineamientos de gobierno digital,
guías de interoperabilidad, exigencias de accesibilidad para sitios y servicios
públicos, y publicación de datos abiertos. Verifica cuáles aplican **antes** de
diseñar la API: cambian el contrato, no la implementación.

## Integración con sistemas del ecosistema

Si el sistema toca contratación, presupuesto, tesorería o reportes de control, es
probable que deba conversar o al menos conciliar con plataformas nacionales
(contratación electrónica, reportes financieros territoriales, sistemas de control
interno). Trátalas como integraciones de Etapa 1: pregunta si exponen servicios, con
qué credenciales, con qué disponibilidad y quién autoriza el acceso. Muchas no tienen
API pública y la "integración" termina siendo cargue de archivos con formato
estricto — mejor saberlo antes de prometerlo.

## Continuidad institucional

Los cambios de administración rotan a los responsables funcionales. Diseña asumiendo
que quien aprobó los requisitos no será quien reciba el sistema:
- Decisiones escritas con su razón, no acuerdos de palabra.
- Manuales dirigidos a quien llega nuevo, no a quien ya sabe.
- Accesos administrativos ligados a cargos, no a personas.
