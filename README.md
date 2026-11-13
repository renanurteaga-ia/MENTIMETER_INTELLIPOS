# IntelliPOS Quiz 2.0 — v2-dev

Plataforma de cuestionarios y exámenes en tiempo real. El presentador lanza sesiones en vivo; los participantes responden desde cualquier dispositivo con navegador.

## URLs

| App | URL |
|-----|-----|
| App principal (sesiones en vivo) | https://intellipos-quiz-app.vercel.app |
| Preparación de cuestionarios | https://intellipos-quiz-app.vercel.app/quiz-prep.html |
| Preparación de listas de participantes | https://intellipos-quiz-app.vercel.app/student-list-prep.html |
| Cursos y dictados | https://intellipos-quiz-app.vercel.app/cursos.html |

---

## Arquitectura

La app está compuesta por `index.html` más **14 módulos JavaScript externos** cargados como `<script src="js/...">`. Cada módulo es independiente y se carga en orden de dependencias.

| Módulo | Responsabilidad |
|--------|----------------|
| `js/config.js` | Credenciales Supabase, cliente `sb`, variables globales de estado |
| `js/utils.js` | `$()`, `genId()`, `getParticipantId()`, `showView()`, `showToast()`, `resetApp()` |
| `js/parser.js` | `parseSheetText()` — convierte TSV en objetos de pregunta; extrae `parsedRangos`, `parsedRangosDim` y `parsedPerfiles`; `loadFromLibrary()` restaura los tres arrays al cargar desde biblioteca |
| `js/session.js` | Crear sesión, lobby del presentador, iniciar quiz/examen |
| `js/realtime.js` | Canal Supabase Realtime + polling de respaldo cada 1.5 s |
| `js/presenter.js` | Flujo del presentador: avanzar preguntas, revelar respuestas, finalizar |
| `js/participant.js` | Flujo del participante: unirse, votar, pantalla de espera y resultado |
| `js/exam-participant.js` | Flujo de examen individual: temporizador, envío, boleta |
| `js/scoring.js` | `calculateScores()` — lógica de puntuación para MC, PONDERADA, NIVEL-RANGO y PERFIL |
| `js/results.js` | Renderizado de resultados en tiempo real (gráficos Chart.js), boleta final |
| `js/grading.js` | Calificación manual de preguntas abiertas por el presentador |
| `js/history.js` | Historial de sesiones pasadas con filtros |
| `js/excel.js` | Descarga del reporte Excel por sesión (`downloadReportExcel`) |
| `js/auth.js` | Login / logout con Supabase Auth; verificación de `authorized_users` |

> **Nota**: el orden de `<script>` en `index.html` importa — `config.js` y `utils.js` deben cargarse antes que cualquier otro módulo.

---

## Flujo de trabajo

### Preparación (antes de la sesión)

0. **Curso y dictado** — Abre `/cursos.html`, crea el curso (con el enlace a su carpeta de Drive) y un dictado por cada vez que se dicta (ej. "2026-II · Sección A").
1. **Cuestionario** — Abre `/quiz-prep.html`, crea un nuevo cuestionario con **Importar Excel** (plantillas de `MENTIMETER1/_Plantillas` en Drive) o pegando el TSV desde Google Sheets. Asigna curso, dictado (o "todos los dictados del curso" para reutilizarlo) y tipo de prueba (parcial, final o práctica), previsualiza y guarda.
2. **Lista de participantes** — Abre `/student-list-prep.html`, importa la plantilla de Excel o pega el padrón (Código · Apellido Paterno · Apellido Materno · Nombres), asigna curso y dictado, y guarda la lista.

### El día de la sesión

1. Abre la app principal e inicia sesión.
2. Filtra por curso, dictado y tipo de prueba; selecciona el cuestionario y la lista de participantes. Si el cuestionario tiene tipo de prueba, queda preseleccionado en la modalidad Examen.
3. Elige modalidad (Cuestionario interactivo o Examen individual) y tipo de acceso (Abierta o Cerrada).
4. Crea la sesión y comparte el código QR o el enlace con los participantes.
5. Al finalizar, los resultados quedan registrados en Supabase y disponibles en **Historial**.

---

## Tipos de cuestionario

### Opción múltiple (MC)
Formato TSV de 10 columnas:

| Col | Contenido |
|-----|-----------|
| 1 | Texto de la pregunta |
| 2–5 | Opciones A, B, C, D |
| 6 | Letra correcta (A, B, C o D) |
| 7 | URL de imagen (opcional) |
| 8 | Puntaje de la pregunta |
| 9 | Número de sesión (opcional) |
| 10 | Tópico (opcional) |

### PONDERADA (diagnóstico ponderado)
Cada opción suma puntos propios; el total se mapea a un rango diagnóstico. No genera nota 0–20.

| Col | Contenido |
|-----|-----------|
| 1 | Texto de la pregunta |
| 2–5 | Opciones A, B, C, D |
| 6 | `PONDERADA` (literal) |
| 7 | URL de imagen (opcional) |
| 8–10 | Puntaje, sesión, tópico |
| 11–14 | Puntaje de cada opción: `puntajeA` · `puntajeB` · `puntajeC` · `puntajeD` |

Al final de las preguntas, agrega filas de rango global (`R1`, `R2`, …):

```
R1	0	20	Riesgo	Necesitas mejorar tu estilo de vida
R2	21	35	Regular	Vas por buen camino
R3	36	50	Saludable	Excelente estilo de vida
```

Las filas de rango opcionales admiten campos adicionales (hasta 8 columnas por fila):

```
R1	min	max	Nombre del rango	Diagnóstico	Tu realidad	Tu reto	Recuerda
```

### NIVEL-RANGO (niveles con dimensiones)
El participante elige un nivel del **1 al 5** en cada pregunta. Las preguntas se agrupan por dimensión; la puntuación de cada dimensión es el **promedio** de los niveles elegidos en sus preguntas (escala 1.0–5.0). El resultado muestra nombre de rango y diagnóstico por dimensión.

Límites: máximo 9 dimensiones, 9 rangos por dimensión.

| Col | Contenido |
|-----|-----------|
| 1 | Texto de la pregunta |
| 2–5 | (vacías) |
| 6 | `NIVEL-RANGO` (literal) |
| 7 | URL de imagen (opcional) |
| 8 | Número de dimensión (1–9) |
| 9 | Nombre de la dimensión |

Al final de las preguntas, agrega filas de rango por dimensión con el formato `Rnm` donde `n` = número de dimensión y `m` = número de rango. Los valores `min` y `max` son sobre la escala **1.0–5.0** (promedio):

```
R11	1.0	2.4	Inicial	Diagnóstico para dimensión 1, rango 1
R12	2.5	3.4	En Desarrollo	Diagnóstico para dimensión 1, rango 2
R13	3.5	5.0	Competente	Diagnóstico para dimensión 1, rango 3
R21	1.0	2.9	Básico	Diagnóstico para dimensión 2, rango 1
R22	3.0	5.0	Avanzado	Diagnóstico para dimensión 2, rango 2
```

> **Cómo se almacenan los votos NIVEL-RANGO**: el participante envía un entero `1–5` por pregunta (no letra A–D). `scoring.js` calcula el promedio por dimensión y lo compara contra los rangos `Rnm`.

### PERFIL (diagnóstico de estilo / perfil personal)
Cuestionario de autodiagnóstico sin respuesta correcta. Cada opción (A/B/C/D) vota por un perfil de personalidad (P1/P2/P3/P4). Al finalizar, el participante ve su perfil dominante con nombre, símbolo y descripción. No genera nota ni puntaje.

**Mapeo de opciones a perfiles:** A → P1 · B → P2 · C → P3 · D → P4

El TSV tiene dos tipos de fila:

**Filas de definición de perfil** — deben ir al inicio del archivo, antes de las preguntas. Formato de 4 columnas:

| Col | Contenido |
|-----|-----------|
| 1 | ID del perfil: `P1`, `P2`, `P3` o `P4` |
| 2 | Nombre del perfil (ej: `Controlador`) |
| 3 | Símbolo visual (ej: `△`, `□`, `✱`, `○`) |
| 4 | Descripción del perfil (texto libre) |

**Filas de pregunta PERFIL** — formato de 6 columnas:

| Col | Contenido |
|-----|-----------|
| 1 | Texto de la pregunta (situación real) |
| 2–5 | Opciones A, B, C, D (cada una redactada desde el estilo del perfil P1–P4 respectivamente) |
| 6 | `PERFIL` (literal) |
| 7 | URL de imagen (opcional) |

**Ejemplo de TSV completo:**

```
P1	Controlador	△	Dominante, formal y 100% orientado/a a resultados. Tu reto: practicar la empatía activa.
P2	Analítico	□	Metódico/a, estructurado/a y perfeccionista. Tu reto: trabajar la flexibilidad.
P3	Promotor	✱	Flexible, informal, entusiasta y alegre. Tu reto: apoyarte en una agenda estructurada.
P4	Soporte	○	Cálido/a y muy enfocado/a en las personas. Tu reto: practicar el amor propio y poner límites.
Cuando un proyecto se retrasa, lo primero que hago es:	Ir directo al grano con el equipo...	Revisar los datos detallados...	Proponer ideas nuevas...	Acercarme con calma...	PERFIL
```

**Comportamiento durante la sesión:**
- El participante ve el texto completo de cada opción (A/B/C/D) sin saber qué perfil representa.
- Tras votar, ve solo la confirmación ("Elegiste la opción C") sin barras de resultados parciales.
- Al finalizar la sesión se revela su perfil dominante con nombre, símbolo, descripción y votos acumulados por perfil.
- El presentador ve la distribución de votos A/B/C/D en tiempo real durante la sesión (sin etiquetas de perfil).

**Almacenamiento de perfiles en `quizzes`:**
Los perfiles se almacenan en el array `rangos` de la tabla `quizzes` como último elemento con la forma `{ "_perfil": true, "data": [{ id, nombre, simbolo, descripcion }, …] }`. No se requiere cambio de esquema.

### Pregunta abierta
Pon `ABIERTA` en la columna 6; las opciones se ignoran. Requiere calificación manual por el presentador.

---

## Lista de participantes

Formato TSV de 4 columnas:

| Col | Contenido |
|-----|-----------|
| 1 | Código de alumno (ej: A00123) |
| 2 | Apellido Paterno |
| 3 | Apellido Materno |
| 4 | Nombres |

El identificador se genera automáticamente: `Inicial.ApellidoPaterno.InicialMaterno` (ej: R.Urteaga.M).

---

## Estado de sesión (`quiz_session.data`)

El campo `data` (jsonb) de la tabla `quiz_session` contiene todo el estado de una sesión en vivo:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `questions` | array | Preguntas parseadas |
| `currentIndex` | int | Índice de pregunta activa |
| `votes` | object | `{ "idx": { pid: "A"/"B"/"C"/"D" o nivel } }` |
| `participantVotes` | object | `{ "pid_idx": "A"/"B"/"C"/"D" }` — para MC y PONDERADA |
| `voters` | object | IDs de quienes ya votaron en la pregunta actual |
| `participants` | object | `{ pid: nombre }` — participantes registrados |
| `examSubmissions` | object | Respuestas de examen por participante |
| `reveal` | bool | Si se muestran las respuestas correctas |
| `status` | string | `'lobby'` \| `'active'` \| `'exam-active'` \| `'ended'` |
| `mode` | string | `'quiz'` \| `'exam'` |
| `accessType` | string | `'open'` \| `'closed'` |
| `timerSeconds` | int | Temporizador por pregunta (0 = sin límite) |
| `examMinutes` | int | Duración total del examen |
| `randomOrder` | bool | Orden aleatorio de preguntas (examen) |
| `rangos` | array | Rangos diagnósticos globales (PONDERADA) |
| `rangosDim` | object | `{ "1": [...], "2": [...] }` — rangos por dimensión (NIVEL-RANGO) |
| `perfiles` | array | `[{ id, nombre, simbolo, descripcion }]` — definiciones de perfiles (PERFIL) |
| `participantList` | array\|null | Lista de participantes (sesión cerrada) |
| `questionChangedAt` | int | Timestamp del último cambio de pregunta |
| `examStartedAt` | int | Timestamp de inicio del examen |
| `name` | string | Nombre de la sesión |
| `sesionDefault` | int\|null | Número de sesión del cuestionario (filtro) |
| `topicoDefault` | string\|null | Tópico del cuestionario (filtro) |

---

## Funcionalidades

- **Cuestionario interactivo**: el presentador controla el ritmo, resultados en tiempo real por pregunta.
- **Examen individual**: cada participante responde a su propio ritmo con cronómetro.
- **Banco de preguntas**: filtro por sesión y tópico; selección aleatoria de N preguntas para exámenes.
- **Tipo PONDERADA**: cuestionario diagnóstico con puntaje ponderado por opción y rangos con diagnóstico, "tu realidad", "tu reto" y "recuerda".
- **Tipo NIVEL-RANGO**: cuestionario de niveles 1–5 agrupados por dimensión; la pantalla de fin de sesión, el PDF del participante y el reporte Excel muestran el promedio por dimensión (escala 1.0–5.0), el nombre del rango alcanzado, el diagnóstico y la comparación con el promedio del salón.
- **Tipo PERFIL**: cuestionario de autodiagnóstico de estilos/perfiles. El participante responde situaciones reales sin saber a qué perfil apunta cada opción; al finalizar ve su perfil dominante con nombre, símbolo y descripción. Sin nota ni puntaje.
- **Preguntas abiertas**: el participante escribe texto libre; el presentador califica manualmente.
- **Sesión cerrada**: acceso restringido a participantes de la lista, validados por código de alumno.
- **Registro de resultados**: al finalizar la sesión se graban los resultados individuales en `session_results`.
- **Historial de sesiones**: el presentador puede revisar resultados de sesiones pasadas, filtrar por cuestionario y ver el detalle por participante.
- **Descarga PDF**: el participante puede descargar su resultado al finalizar. Para MC/PONDERADA muestra nota, puntaje y diagnóstico; para NIVEL-RANGO muestra cards por dimensión con promedio/5, nombre de rango, diagnóstico y comparación con el salón.
- **Descarga Excel**: el presentador descarga el reporte completo de la sesión por participante.
- **Imágenes por pregunta**: almacenadas en Supabase Storage (bucket `quiz-images`, público). No usar Wikimedia ni otros CDNs con bloqueo de hotlinking.
- **Login con Supabase Auth**: solo presentadores registrados en `authorized_users` pueden acceder.
- **Toast notifications**: sistema de notificaciones no bloqueantes (`showToast(msg, type, duration)`).

---

## Stack

- HTML / CSS / JavaScript (14 módulos externos en `js/`, sin framework)
- Supabase — PostgreSQL + Auth + Realtime + Storage
- Tailwind CSS (CDN)
- Chart.js (CDN) — gráficos de resultados en tiempo real
- Vercel (hosting)
- GitHub — rama activa: `v2-dev`

---

## Base de datos Supabase

| Tabla | Descripción | Campos clave |
|-------|-------------|--------------|
| `quiz_session` | Sesiones en vivo activas | `id`, `data` (jsonb) |
| `quizzes` | Biblioteca de cuestionarios | `id`, `nombre`, `preguntas` (jsonb), `tipo`, `rangos` (jsonb) |
| `participant_lists` | Listas de participantes | `id`, `nombre`, `lista` (jsonb) |
| `session_results` | Resultados individuales por sesión | `quiz_session_id`, `quiz_id`, `participante_codigo`, `respuestas` (jsonb), `puntaje_obtenido`, `puntaje_posible`, `nota` (MC), `puntaje_total` (PONDERADA), `rango_obtenido` (jsonb), `rangos_dim_obtenidos` (jsonb, NIVEL-RANGO) |
| `authorized_users` | Presentadores autorizados | `email`, `activo`, `nombre` |
| `cursos` | Cursos | `id`, `nombre`, `descripcion`, `drive_url` |
| `dictados` | Cada vez que se dicta un curso | `id`, `curso_id`, `nombre`, `fecha_inicio`, `fecha_fin` |

`quizzes` y `participant_lists` tienen además `curso_id` y `dictado_id` (un cuestionario con `dictado_id` vacío sirve para todos los dictados de su curso); `quizzes` tiene `tipo_prueba` (`parcial` · `final` · `practica`). Se crean con `supabase_cursos.sql` (ejecutar una vez en el SQL Editor). Mientras no se ejecute, la app funciona como antes, sin los selectores de curso.

Storage: bucket `quiz-images` (público).

### Campo `rangos` en `quizzes` — almacenamiento extendido

El array `rangos` de la tabla `quizzes` se usa como contenedor polimórfico para todos los metadatos de diagnóstico. Los elementos especiales llevan una clave `_xxx: true` que los diferencia de los rangos normales:

| Tipo de elemento | Forma | Usado por |
|-----------------|-------|-----------|
| Rango global | `{ nombre, min, max, diagnostico, … }` | PONDERADA |
| Rangos de dimensión | `{ "_dim": true, "data": { "1": […], "2": […] } }` | NIVEL-RANGO |
| Perfiles | `{ "_perfil": true, "data": [{ id, nombre, simbolo, descripcion }] }` | PERFIL |

No se requiere cambio de esquema para soportar nuevos tipos.

---

## Variables globales de estado (config.js)

```javascript
let sessionData     // estado completo de la sesión activa
let cloudId         // ID de la sesión en Supabase (ej: 's_abc1234')
let chartInst       // instancia de Chart.js activa
let rtChannel       // canal Supabase Realtime
let rtConnected     // bool: conectado por websocket
let fallbackInt     // setInterval de polling de respaldo
let timerInt        // setInterval del temporizador por pregunta
let participantId   // ID único del participante (UUID persistido en localStorage)
let participantNick // Nombre del participante
let isPresenter     // bool: true si esta pestaña actúa como presentador
let lastRenderedIdx // último índice renderizado (detección de cambio de pregunta)
let selectedParticipantList // lista cargada { id, nombre, lista:[] }
```

Variables del parser (disponibles tras llamar `parseSheetText()` o `loadFromLibrary()`):

```javascript
let parsedQuestions    // array de objetos pregunta
let parsedRangos       // rangos globales (PONDERADA)
let parsedRangosDim    // rangos por dimensión { "1": [...], "2": [...] } (NIVEL-RANGO)
let parsedPerfiles     // perfiles [{ id, nombre, simbolo, descripcion }] (PERFIL)
```

---

## Ramas Git

| Rama | Estado | Descripción |
|------|--------|-------------|
| `main` | Estable | Versión quiz-only sin login |
| `v2` | Estable | Quiz + examen + login + imágenes por URL |
| `v2-dev` | Activa | Versión completa: biblioteca, listas, PONDERADA, NIVEL-RANGO, PERFIL, historial, PDF, Excel |

---

## Deploy

```bash
vercel --prod --yes
```

Desde la carpeta del proyecto donde está `index.html` y el proyecto ya está vinculado con Vercel CLI. Script alternativo (usa la API REST directamente, sin CLI):

```bash
node ~/proyectos/mentimeter1/deploy-vercel-device.js
```

---

## Changelog

### 2026-10-08
- **Nuevo tipo PERFIL**: cuestionario de autodiagnóstico de estilos de comunicación/personalidad. Implementado en los 6 módulos afectados: `parser.js`, `session.js`, `scoring.js`, `results.js`, `participant.js`, `excel.js`.
- **Fix `quiz-prep.html`**: el parser interno de la página de preparación no reconocía el tipo PERFIL ni las filas P1-P4. Corregido para detectar filas de definición de perfil, manejar preguntas `PERFIL`, almacenar `parsedPerfiles` y guardarlos en Supabase junto con el cuestionario. Añadido bloque de previsualización de perfiles (panel rosa) en la pantalla de gestión de imágenes. Añadida reconstrucción correcta del TSV al editar un cuestionario PERFIL guardado.
- **Fix `parser.js` — `loadFromLibrary()`**: al cargar un cuestionario PERFIL desde la biblioteca, ahora se extrae el marcador `{ _perfil: true, data: […] }` del array `rangos` y se restaura `parsedPerfiles`, que luego se inyecta en la sesión vía `session.js`.
- **Fix `participant.js`**: las opciones PERFIL se mostraban como etiquetas de perfil (P1: △ Controlador) en vez del texto real de la opción. Corregido para mostrar el texto completo con etiqueta A/B/C/D. Tras votar, se muestra la letra elegida y el texto de la opción sin revelar el perfil ni resultados parciales. Los resultados de distribución por perfil solo se muestran al finalizar la sesión completa.

### 2026-10-03
- **Prueba integral end-to-end**: verificación completa de los 5 tipos de cuestionario en producción (sesiones `s_sdxlpsc`, `s_5c51fxv`, `s_wm5dyns`, `s_5zrb9a2`, `s_4jc9f30`). Todos los tipos pasaron: MC, MC+imágenes, preguntas abiertas, PONDERADA con rangos, NIVEL-RANGO con 2 dimensiones.
- **Fix utils.js**: etiqueta `</script>` espuria en la línea 58 que causaba `Uncaught SyntaxError` bloqueando la carga de todos los módulos. Corregida y desplegada a producción.
- **Documentación**: README actualizado con arquitectura modular de 14 módulos, estructura completa de `quiz_session.data`, variables globales, formato de votos NIVEL-RANGO (enteros 1–5) y nota sobre imágenes (no usar Wikimedia).

### 2026-09-23
- **Fix NIVEL-RANGO — pantalla del participante**: `renderEndParticipant()` hacía dos llamadas a `calculateScores()`. La segunda podía devolver `undefined` dejando `hasNivelRango = false` y disparando el flujo MC. Consolidado a una sola llamada; añadido botón "Descargar mi resultado (PDF)" en el bloque nivel_rango.
- **Fix NIVEL-RANGO — PDF (`printParticipantResult`)**: no existía rama para nivel_rango; caía al flujo MC mostrando "null:", "0 de 0 correctas" y "preguntas abiertas". Añadido bloque `else if (hasNivelRango)` con cards por dimensión (promedio/5, rango, diagnóstico, comparación salón) y tabla de respuestas con niveles resaltados.
- **Fix NIVEL-RANGO — Excel (`downloadReportExcel`)**: en la vista del instructor `sessionData.questions` llega sin `q.tipo` normalizado. La detección `q.tipo === 'nivel_rango'` fallaba → Excel mostraba ceros. Se aplica `normalizarPreguntas()` al inicio de la función antes de cualquier procesamiento.
- **Corrección README**: la puntuación NIVEL-RANGO es un **promedio** (1.0–5.0), no una suma. Actualizados ejemplos de rangos.
