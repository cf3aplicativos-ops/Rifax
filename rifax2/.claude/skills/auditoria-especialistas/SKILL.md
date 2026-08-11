---
name: auditoria-especialistas
description: Orquesta una auditoría completa de seguridad y calidad de RIFAX (rifax2) usando los 5 agentes especialistas del proyecto — seguridad-appsec, backend-datos-prisma, frontend-nextjs, devops-vercel, calidad-qa — cada uno revisando, sugiriendo y aplicando correcciones acotadas en su dominio, alineadas con OWASP Top 10/ASVS, ISO/IEC 27001 e ISO/IEC 25010. Úsalo siempre que el usuario pida una auditoría de seguridad o calidad de RIFAX, una revisión con estándares internacionales, un "chequeo general" del software, o mencione a los 5 especialistas / agentes especialistas del proyecto.
---

# Auditoría con los 5 especialistas de RIFAX

Este skill ejecuta, uno tras otro, a los cinco subagentes ya definidos en
`C:\Proyectos\Rifax\rifax2\.claude\agents\`: **seguridad-appsec**,
**backend-datos-prisma**, **frontend-nextjs**, **devops-vercel** y
**calidad-qa**. Cada uno es experto en su dominio y ya sabe auditar,
priorizar hallazgos por severidad, aplicar correcciones acotadas y
verificar con `npm run build`. Este skill es el que los coordina en una
sola pasada completa sobre el repo.

## Por qué uno a la vez, no en paralelo

Los 5 agentes editan directamente sobre `C:\Proyectos\Rifax\rifax2` (no usan
git worktrees aislados). Si corrieran en paralelo, dos agentes podrían
editar el mismo archivo a la vez y pisarse los cambios, o uno podría dejar
el build roto mientras otro sigue trabajando sobre esa base rota. Correrlos
en secuencia, con una verificación de build/pruebas entre cada uno, es más
lento pero elimina ese riesgo por completo — y permite detectar de
inmediato si un agente introdujo una regresión, antes de que el siguiente
construya sobre ella.

## Orden de ejecución

1. `seguridad-appsec` — primero, porque una vulnerabilidad de seguridad es
   el riesgo más alto y no debe esperar a que los demás terminen.
2. `backend-datos-prisma` — la capa de datos es la base de todo lo demás.
3. `frontend-nextjs`
4. `devops-vercel`
5. `calidad-qa` — al final, porque puede agregar pruebas que cubran el
   comportamiento ya corregido por los agentes anteriores.

## Pasos

### 1. Línea base
Antes de lanzar el primer agente, corre en `C:\Proyectos\Rifax\rifax2`:
```
npm run build
npm test
```
Si el build o las pruebas ya están rotos antes de empezar, dilo al usuario
y pregunta si quiere continuar de todos modos — la auditoría puede seguir,
pero el usuario debe saber que la falla no la introdujo ningún agente.

### 2. Lanzar cada agente (secuencial, en primer plano)
Para cada uno de los 5, en el orden de arriba, usa el tool `Agent` con
`subagent_type` igual al nombre del agente, `run_in_background: false`
(necesitas su resultado antes de decidir si sigues), y un prompt que
incluya:

- Que el código vive en `C:\Proyectos\Rifax\rifax2`, y que revise todo lo
  relevante a su dominio bajo `src/` y `prisma/`.
- Que para orientarse sobre qué cambió recientemente, puede correr
  `git log --oneline -20` en esa carpeta — así prioriza donde es más
  probable que haya algo nuevo sin revisar, sin ignorar el resto del código.
- Que siga exactamente el "Método de trabajo" y los "Guardrails" ya
  definidos en su propio archivo de agente (auditar → priorizar por
  severidad con archivo:línea → aplicar solo correcciones acotadas y
  seguras que no cambien el comportamiento observable → verificar con
  `npm run build` → reportar resumen ejecutivo + tabla de hallazgos +
  estado del build).
- Que NO haga commit, NO despliegue (`vercel deploy`), y NO haga cambios
  destructivos de base de datos — eso lo decide el usuario después.

Espera el reporte completo del agente antes de continuar.

### 3. Verificar después de cada agente
Apenas termine cada agente, corre de nuevo:
```
npm run build
npm test
```
- Si ambos pasan limpio, continúa con el siguiente agente de la lista.
- Si algo se rompió, **detente** — no lances al siguiente agente todavía.
  Lee el error, decide si es algo simple de corregir tú mismo (haciéndolo
  directamente) o si hace falta pedirle al mismo agente que lo arregle
  (puedes invocar `Agent` de nuevo con el mismo `subagent_type` y un prompt
  explicando qué rompió). Solo sigue con el siguiente especialista una vez
  que el build y las pruebas vuelvan a pasar.

### 4. Resumen consolidado
Cuando los 5 hayan terminado (y el build/pruebas pasen), preséntale al
usuario un resumen que junte los 5 reportes:
- Qué corrigió cada especialista (lista breve por agente).
- Hallazgos que los agentes dejaron **documentados pero sin aplicar**
  porque requieren una decisión humana (cambios de comportamiento, de
  esquema de datos, o de alto riesgo) — estos son los que más le importan
  al usuario, ponlos en un lugar visible, no al final perdidos.
- Estado final del build y las pruebas.
- Aclara que nada se hizo commit ni se desplegó — los cambios quedan en el
  working tree para que el usuario los revise (`git status`/`git diff`) y
  decida.

### 5. Bitácora
Agrega una entrada fechada a `docs/bitacora.md` (siguiendo el formato ya
usado en ese archivo) resumiendo qué auditó cada agente y qué se corrigió,
para que quede como registro del proyecto.

## Qué NO hacer
- No corras los 5 agentes en paralelo ni con `run_in_background: true` —
  perderías la capacidad de detectar y frenar una regresión a tiempo.
- No hagas `git commit`, `git push` ni `vercel deploy` como parte de este
  skill, aunque los agentes reporten que todo quedó verificado — eso es
  una decisión del usuario, no de la auditoría.
- No reescribas ni resumas de más los hallazgos que un agente marcó como
  "de alto riesgo, no aplicado" — pásalos íntegros al usuario para que
  decida con la información completa.
