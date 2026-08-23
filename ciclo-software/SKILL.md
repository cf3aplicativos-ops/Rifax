---
name: ciclo-software
description: Guía disciplinada del ciclo de desarrollo de software en siete etapas con compuertas de avance, separando explícitamente las decisiones que toma el humano de la ejecución que delega en la IA. Úsala siempre que el usuario vaya a iniciar, planear, cotizar, diseñar, construir, desplegar, auditar o rescatar un sistema o aplicación — incluso si solo dice "hagamos una app", "necesito una plataforma para X", "empecemos el proyecto", "¿cómo arranco esto?", o si pide código para algo que claramente es un sistema nuevo y no un script suelto. Úsala también cuando pida revisar un proyecto ya en marcha para encontrar qué se saltó. Aplica tanto en Claude Code sobre un repositorio como en conversación para producir documentos de decisión.
---

# Ciclo de software con compuertas

## Para qué existe esta skill

Un sistema no fracasa porque alguien escriba mal una función. Fracasa porque nadie
decidió qué pasa si se cae, quién puede ver qué, cómo se revierte un despliegue malo,
y quién lo mantiene cuando el proveedor se va. La IA escribe código rápido; eso hace
que sea *más* fácil, no menos, saltarse esas decisiones y descubrirlas seis meses
después en producción.

Esta skill impone un orden y, sobre todo, reparte responsabilidades: hay decisiones
que la IA no debe tomar sola aunque pueda, porque quien responde por ellas es el
humano. El objetivo es trabajo mancomunado real, no delegación ciega ni supervisión
teatral.

## Cómo repartir el trabajo

Cada decisión del proyecto se marca con uno de tres roles. Respeta el marcado: es el
corazón de la skill.

- **[H] Decide el humano.** La IA presenta 2–3 opciones con sus costos, riesgos y
  consecuencias, recomienda una y **se detiene a esperar**. No asume la respuesta ni
  la infiere del silencio. Son decisiones donde el que responde legal, contractual o
  económicamente es la persona.
- **[IA] Ejecuta la IA.** Trabajo mecánico o derivable de decisiones ya cerradas. La
  IA lo hace completo y el humano lo revisa por muestreo.
- **[H+IA] Se construye a cuatro manos.** La IA redacta un borrador desde lo que ya
  sabe, el humano corrige lo que solo él conoce (el contexto de la entidad, el
  proceso real, la política interna).

Cuando la IA no sepa algo que necesita, **debe preguntar en vez de inventar un
supuesto plausible**. Un supuesto no confirmado que llega hasta producción es
exactamente el tipo de falla que esta skill previene. Si el humano no puede
responder todavía, se registra como supuesto abierto en el estado, con dueño.

## Las siete etapas

| # | Etapa | Pregunta que cierra |
|---|-------|---------------------|
| 1 | Requisitos y contexto | ¿Qué problema resolvemos, para quién y bajo qué restricciones? |
| 2 | Diseño | ¿Cómo se estructura, qué datos maneja y quién puede hacer qué? |
| 3 | Entorno y disciplina | ¿Cómo trabajamos sin pisarnos ni exponer secretos? |
| 4 | Construcción | ¿Está hecho y probado lo que se acordó? |
| 5 | Endurecimiento | ¿Aguanta uso hostil y carga real? |
| 6 | Despliegue | ¿Está publicado, observable y reversible? |
| 7 | Operación y entrega | ¿Se sostiene sin nosotros? |

Seguridad, pruebas, versionado, documentación y observabilidad **no son la etapa 5 ni
la 6**: atraviesan las siete. Si aparecen solo al final, ya es tarde.

Pasarelas de pago, correo transaccional y publicación en tiendas móviles son
**condicionales**: solo entran si el producto los necesita. No infles el alcance con
temas que no aplican.

## Flujo de trabajo

### Al iniciar (o retomar) un proyecto

1. Busca `.ciclo/estado.md` en el repositorio o pregunta por él. Si existe, **léelo
   primero**: es la memoria del proyecto entre sesiones. Reporta en qué etapa va, qué
   compuertas están abiertas y qué supuestos siguen sin confirmar.
2. Si no existe, créalo desde `assets/estado.plantilla.md` y arranca en la Etapa 1.
   En conversación (sin repositorio), mantén el estado como documento que el usuario
   guarda y te reingresa; ofrécele generarlo en cada corte.
3. Si el proyecto ya está en marcha y nadie llevó este control, entra en **modo
   auditoría**: recorre las etapas hacia atrás preguntando qué se decidió, y marca lo
   que se saltó como deuda con dueño y fecha. No obligues a rehacer lo que ya
   funciona; obliga a hacerlo consciente.

### Dentro de cada etapa

1. Lee el archivo de referencia de la etapa en `references/` — ahí están las preguntas
   concretas, los riesgos típicos y el criterio de salida. Léelo cuando entres a la
   etapa, no todos de una vez.
2. Haz las preguntas **de a pocas y en orden de impacto**. No lances un cuestionario
   de treinta puntos: pregunta lo que desbloquea la siguiente decisión, tres o cuatro
   a la vez como máximo. Si el usuario está en móvil, usa opciones seleccionables
   cuando la herramienta esté disponible.
3. Ejecuta lo que sea `[IA]` sin pedir permiso para cada paso; muestra el resultado.
4. Registra cada decisión `[H]` en el acta de la etapa con la opción elegida y la
   razón. Una decisión sin razón escrita se vuelve a discutir en tres meses.
5. Al cerrar, genera el **acta de etapa** desde `assets/acta-de-etapa.plantilla.md` y
   actualiza `.ciclo/estado.md`.

### Las compuertas

**No avances de etapa mientras queden decisiones `[H]` sin cerrar.** Esto es firme,
no una sugerencia. Si el usuario pide saltar adelante —típicamente "empecemos a
programar ya"— responde así:

> Podemos, pero faltan estas decisiones de la Etapa 2: [lista]. Sin ellas, lo que
> escribamos hoy probablemente haya que rehacerlo. ¿Las cerramos ahora (calculo unos
> X minutos) o las registro como desvío aceptado y seguimos?

Si el usuario elige seguir de todos modos, **regístralo como desvío** en
`.ciclo/estado.md`: qué se saltó, por qué, quién lo autorizó, qué se rompería si el
supuesto falla y en qué momento hay que volver. Un desvío consciente y anotado es
gestión de riesgo; uno silencioso es la falla del video. Nunca lo dejes pasar sin
anotarlo, y recuérdalo al inicio de la siguiente sesión.

Excepción legítima al orden: un **spike** o prototipo desechable para responder una
duda técnica. Se permite en cualquier momento, siempre que quede marcado como
desechable y no se convierta en la base del sistema.

## Calibración por tamaño

No apliques el mismo peso a todo. Al inicio, clasifica el proyecto y dilo:

- **Pequeño** (uso interno, pocos usuarios, sin datos sensibles, sin dinero): las
  siete etapas siguen aplicando, pero el acta de cada una puede ser un párrafo. Lo
  innegociable: backups probados, secretos fuera del repositorio, y saber quién lo
  mantiene.
- **Mediano** (usuarios externos, datos personales, integraciones): actas completas,
  ADR para las decisiones estructurales, pruebas automatizadas.
- **Crítico** (dinero, servicio público, indisponibilidad con consecuencia legal o
  ciudadana): además, plan de recuperación probado, trazabilidad de auditoría, y
  transferencia de conocimiento documentada desde el día uno.

Si el proyecto es para una entidad pública colombiana, lee también
`references/contexto-colombia.md`: hay obligaciones de datos personales, archivo,
contratación e interoperabilidad que cambian decisiones de diseño, no solo papeleo.

## Artefactos que produce

Todos en `.ciclo/` dentro del repositorio (o como documentos entregables en
conversación):

| Archivo | Cuándo | Plantilla |
|---------|--------|-----------|
| `estado.md` | Vive todo el proyecto, se actualiza en cada cierre | `assets/estado.plantilla.md` |
| `actas/etapa-N.md` | Al cerrar cada etapa | `assets/acta-de-etapa.plantilla.md` |
| `adr/NNN-titulo.md` | Cada decisión estructural con alternativas descartadas | `assets/adr.plantilla.md` |
| `riesgos.md` | Desde Etapa 1, se revisa en cada compuerta | `assets/riesgos.plantilla.md` |

Escribe las actas en español, en prosa breve y concreta. Nada de relleno: un acta que
nadie lee no protege a nadie. Si el usuario prefiere otro formato de salida (Word,
PDF), genera el contenido igual y conviértelo al final.

Para ver el estado del proyecto de un vistazo:

```bash
python scripts/estado.py .ciclo/estado.md
```

Imprime la etapa actual, las compuertas pendientes, los desvíos vigentes y los
supuestos sin confirmar. Úsalo al abrir sesión en un repositorio.

## Cómo hablar durante todo esto

Sé el ingeniero que hace las preguntas incómodas temprano, no el que dice que sí a
todo. Cuando el usuario proponga algo que va a doler después, dilo con la
consecuencia concreta —"si guardamos las credenciales ahí, cualquiera con acceso al
repositorio entra a producción"— y ofrece la alternativa. Pero no bloquees el trabajo
por purismo: la meta es que el sistema sobreviva a su primer año, no que cumpla un
manual.

Y cuando el usuario tenga razón y tú no, cede rápido. Él conoce la entidad, el
contrato y a los usuarios; tú conoces los modos de falla.
