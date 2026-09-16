# IntelliPOS Quiz 2.0

Plataforma de cuestionarios y exámenes en tiempo real. El presentador lanza sesiones en vivo; los participantes responden desde cualquier dispositivo con navegador.

## URLs

| App | URL |
|-----|-----|
| App principal (sesiones en vivo) | https://intellipos-quiz-app.vercel.app |
| Preparación de cuestionarios | https://intellipos-quiz-app.vercel.app/quiz-prep.html |
| Preparación de listas de participantes | https://intellipos-quiz-app.vercel.app/student-list-prep.html |

## Flujo de trabajo

### Preparación (antes de la sesión)

1. **Cuestionario** — Abre `/quiz-prep.html`, crea un nuevo cuestionario pegando el TSV desde Google Sheets, previsualiza y guarda en la biblioteca.
2. **Lista de participantes** — Abre `/student-list-prep.html`, pega el padrón (Código · Apellido Paterno · Apellido Materno · Nombres) y guarda la lista.

### El día de la sesión

1. Abre la app principal e inicia sesión.
2. Selecciona el cuestionario y la lista de participantes.
3. Elige modalidad (Cuestionario interactivo o Examen individual) y tipo de acceso (Abierta o Cerrada).
4. Crea la sesión y comparte el código QR o el enlace con los participantes.
5. Al finalizar, los resultados quedan registrados en Supabase y disponibles en **Historial**.

---

## Tipos de cuestionario

### Opción múltiple (MC)
Formato TSV estándar de 6 columnas:

| Col | Contenido |
|-----|-----------|
| 1 | Texto de la pregunta |
| 2–5 | Opciones A, B, C, D |
| 6 | Letra correcta (A, B, C o D) |

### PONDERADA (diagnóstico ponderado)
Cada opción suma puntos propios; el total se mapea a un rango diagnóstico. No genera nota 0–20.

| Col | Contenido |
|-----|-----------|
| 1 | Texto de la pregunta |
| 2–5 | Opciones A, B, C, D |
| 6 | `PONDERADA` (literal) |
| 7–10 | (vacías) |
| 11–14 | Puntaje de cada opción: PtjA · PtjB · PtjC · PtjD |

Al final de las preguntas, agrega filas de rango:

```
R1	52	60	Muy alta resiliencia	Descripción del diagnóstico	Tu realidad (opcional)	Tu reto (opcional)	Recuerda (opcional)
R2	42	51	Alta resiliencia	...
```

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

## Funcionalidades

- **Cuestionario interactivo**: el presentador controla el ritmo, resultados en tiempo real por pregunta.
- **Examen individual**: cada participante responde a su propio ritmo con cronómetro.
- **Tipo PONDERADA**: cuestionario diagnóstico con puntaje ponderado por opción y rangos con diagnóstico, "tu realidad", "tu reto" y "recuerda".
- **Preguntas abiertas**: el participante escribe texto libre; el presentador califica manualmente.
- **Sesión cerrada**: acceso restringido a participantes de la lista, validados por código de alumno.
- **Registro de resultados**: al finalizar la sesión se graban los resultados individuales en `session_results`.
- **Historial de sesiones**: el presentador puede revisar resultados de sesiones pasadas, filtrar por cuestionario y ver el detalle por participante.
- **Descarga PDF**: el participante puede descargar su resultado al finalizar (puntaje, estadísticas del grupo, diagnóstico, detalle de respuestas).
- **Imágenes por pregunta**: almacenadas en Supabase Storage (bucket `quiz-images`, público).
- **Login con Supabase Auth**: solo presentadores registrados en `authorized_users` pueden acceder.

---

## Stack

- HTML / CSS / JavaScript (single file por app, sin framework)
- Supabase — PostgreSQL + Auth + Realtime + Storage
- Tailwind CSS (CDN)
- Vercel (hosting)
- GitHub — rama activa: `v2-dev`

---

## Base de datos Supabase

| Tabla | Descripción | Campos clave |
|-------|-------------|--------------|
| `quiz_session` | Sesiones en vivo activas | `id`, `data` (jsonb) |
| `quizzes` | Biblioteca de cuestionarios | `id`, `nombre`, `preguntas` (jsonb), `tipo`, `rangos` (jsonb) |
| `participant_lists` | Listas de participantes | `id`, `nombre`, `lista` (jsonb) |
| `session_results` | Resultados individuales por sesión | `quiz_session_id`, `quiz_id`, `participante_codigo`, `respuestas` (jsonb), `puntaje_obtenido`, `puntaje_posible`, `nota` (MC), `puntaje_total` (PONDERADA), `rango_obtenido` (jsonb) |
| `authorized_users` | Presentadores autorizados | `email`, `activo`, `nombre` |

Storage: bucket `quiz-images` (público).

---

## Ramas Git

| Rama | Estado | Descripción |
|------|--------|-------------|
| `main` | Estable | Versión quiz-only sin login |
| `v2` | Estable | Quiz + examen + login + imágenes por URL |
| `v2-dev` | Activa | Versión completa: biblioteca, listas, PONDERADA, historial, PDF |

---

## Deploy

```bash
node ~/proyectos/mentimeter1/deploy-vercel-device.js
```

El script usa la API REST de Vercel directamente (no requiere CLI). Subir archivos y crear el deployment de producción tarda ~30 segundos.
