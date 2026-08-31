# IntelliPOS Interactive 2.0 — v2

Plataforma de cuestionarios y exámenes en tiempo real, similar a Mentimeter. Incluye biblioteca de cuestionarios con soporte de imágenes.

## Aplicaciones

### 1. App principal — Sesión en Vivo
**URL:** `https://mentimeter-intellipos.vercel.app`

El presentador selecciona un cuestionario de la biblioteca y lanza una sesión en vivo. Los participantes se unen con un código o QR desde cualquier dispositivo.

### 2. App de preparación — Biblioteca de Cuestionarios
**URL:** `https://mentimeter-intellipos.vercel.app/quiz-prep.html`

Permite crear y gestionar cuestionarios con anticipación. Soporta carga de imágenes por pregunta almacenadas en Supabase Storage.

## Flujo de trabajo recomendado

### Preparación (días antes de la sesión)
1. Abre la app de preparación (`/quiz-prep.html`)
2. Haz clic en **"+ Nuevo cuestionario"**
3. Escribe un nombre para el cuestionario
4. Pega las preguntas desde Google Sheets
5. Haz clic en **"Previsualizar preguntas"**
6. Sube imágenes para cada pregunta (opcional)
7. Haz clic en **"Guardar cuestionario"** — queda guardado en la biblioteca

### El día de la sesión
1. Abre la app principal
2. En "Biblioteca de cuestionarios", selecciona el cuestionario preparado
3. Haz clic en **"Usar"**
4. Escribe el nombre de la sesión y elige la modalidad (Cuestionario o Examen)
5. Haz clic en **"Crear Sesión en Vivo"**
6. Comparte el código QR o el link con los participantes

## Formato de preguntas (Google Sheets)

Copia y pega las celdas directamente desde Google Sheets. El formato esperado es de **6 columnas obligatorias**:

| Columna | Contenido | Obligatoria |
|---------|-----------|-------------|
| 1 | Texto de la pregunta | ✅ |
| 2 | Opción A | ✅ |
| 3 | Opción B | ✅ |
| 4 | Opción C | ✅ |
| 5 | Opción D | ✅ |
| 6 | Letra de la respuesta correcta (A, B, C o D) | ✅ |

La fila de encabezado es ignorada automáticamente si la primera celda contiene la palabra "Pregunta" o "Question".

### Ejemplo

```
Pregunta	Opción A	Opción B	Opción C	Opción D	Correcta
¿Cuál es la capital de Francia?	Madrid	París	Roma	Berlín	B
¿Cuántos lados tiene un triángulo?	2	3	4	5	B
```

> Las imágenes se suben directamente desde la app de preparación — no se necesita ninguna columna adicional en Google Sheets.

## Imágenes en preguntas

Las imágenes se almacenan en **Supabase Storage** (bucket `quiz-images`, público). Se suben desde la app de preparación, una por pregunta. No es necesario modificar el archivo de Google Sheets.

## Funcionalidades

- Cuestionarios en vivo con resultados en tiempo real
- Modo examen con orden aleatorio de preguntas (anti-copia)
- Biblioteca de cuestionarios guardados con imágenes
- App separada para preparación de cuestionarios con anticipación
- Login con autenticación Supabase Auth
- Control de acceso por lista de usuarios autorizados
- Participantes identificados por nickname
- Imágenes por pregunta almacenadas en Supabase Storage

## Stack

- HTML/CSS/JS (single file por app)
- Supabase (base de datos + autenticación + realtime + storage)
- Tailwind CSS (via CDN)
- Vercel (hosting)

## Ramas

- `main` → versión quiz-only (sin login, sin exámenes)
- `v2` → versión estable anterior (quiz + examen + login + imágenes por URL)
- `v2-dev` → versión activa (quiz + examen + login + biblioteca de cuestionarios + imágenes en Supabase Storage)

## Base de datos Supabase

### Tablas
- `quiz_session` — sesiones en vivo activas
- `quizzes` — biblioteca de cuestionarios guardados

### Storage
- Bucket `quiz-images` (público) — imágenes de preguntas

## Requisitos

Necesitas estar registrado como usuario autorizado en Supabase para acceder a la app principal.
