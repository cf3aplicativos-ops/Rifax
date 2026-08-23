# Etapa 3 — Entorno y disciplina de trabajo

Se monta **antes** de escribir código de negocio. Instalarlo después es la deuda
técnica más cara que existe, porque para entonces ya hay secretos en el repositorio y
cambios que nadie sabe quién hizo.

## Preguntas, en orden de impacto

- ¿Dónde vive el código y quién tiene acceso de escritura?
- ¿Dónde viven los secretos? Si la respuesta es "en el repositorio" o "en un archivo
  que nos pasamos por chat", hay que resolverlo hoy.
- ¿Quién tiene acceso a producción y cómo se revoca cuando alguien sale del equipo?
- ¿Hay ambientes separados de desarrollo, pruebas y producción? ¿Pruebas se parece a
  producción o es un ambiente de mentiras?
- ¿Con qué datos se prueba? Si son datos reales de personas, hay que anonimizarlos.
- ¿Qué debe pasar automáticamente antes de que un cambio llegue a producción?
- ¿Cómo se nombran las ramas y quién aprueba una fusión? Aunque el equipo sea de uno,
  la regla protege al que llegue después.
- ¿Dónde se documentan las decisiones y cómo lo encuentra alguien nuevo?

## Decisiones

- **[H]** Quién tiene acceso a producción y a los secretos.
- **[H]** Herramientas de repositorio, integración continua y gestión de secretos
  (suele depender de lo que la entidad ya tiene y paga).
- **[H]** Política de datos de prueba.
- **[IA]** Configuración del repositorio, `.gitignore`, plantillas de variables de
  entorno, canalización de integración continua, formateo y análisis estático,
  estructura de carpetas, README inicial.
- **[IA]** Guion de arranque para que otra persona levante el proyecto desde cero.

## Riesgos típicos de esta etapa

- Credenciales versionadas por accidente en el primer commit. Una vez publicadas hay
  que rotarlas, no basta con borrarlas.
- Un solo ambiente que hace las veces de todo, así que probar es arriesgar.
- Base de datos de pruebas copiada de producción con datos personales reales.
- Nadie más que una persona sabe levantar el proyecto.

## Criterio de salida (compuerta 3)

- [ ] Repositorio con control de acceso definido
- [ ] Secretos fuera del código, con mecanismo de gestión acordado
- [ ] Ambientes separados y documentados
- [ ] Integración continua ejecutando pruebas y análisis estático en cada cambio
- [ ] Migraciones de base de datos versionadas desde el inicio
- [ ] Otra persona puede levantar el proyecto siguiendo el README
