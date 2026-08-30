# IntelliPOS Interactive 2.0 — v2

Versión completa con cuestionarios, exámenes y sistema de login.

## Funcionalidades

- Cuestionarios en vivo con resultados en tiempo real
- Modo examen con orden aleatorio de preguntas (anti-copia)
- Login con autenticación Supabase Auth
- Control de acceso por lista de usuarios autorizados
- Participantes identificados por nickname
- **Imágenes en preguntas** — columna opcional con URL externa (Google Drive u otro)

## Formato de preguntas (Google Sheets)

Copia y pega las celdas directamente desde Google Sheets. El formato esperado es de **6 columnas obligatorias** y **1 columna opcional**:

| Columna | Contenido | Obligatoria |
|---------|-----------|-------------|
| 1 | Texto de la pregunta | ✅ |
| 2 | Opción A | ✅ |
| 3 | Opción B | ✅ |
| 4 | Opción C | ✅ |
| 5 | Opción D | ✅ |
| 6 | Letra de la respuesta correcta (A, B, C o D) | ✅ |
| 7 | URL de imagen (Google Drive u otra URL directa) | ⬜ Opcional |

La fila de encabezado es ignorada automáticamente si la primera celda contiene la palabra "Pregunta" o "Question".

Las preguntas sin imagen simplemente dejan la columna 7 vacía — no afectan a las demás preguntas.

### Ejemplo

```
Pregunta	Opción A	Opción B	Opción C	Opción D	Correcta	Imagen
¿Cuál es la capital de Francia?	Madrid	París	Roma	Berlín	B	https://drive.google.com/file/d/ABC123XYZ/view?usp=sharing
¿Cuántos lados tiene un triángulo?	2	3	4	5	B	
```

## Cómo agregar imágenes desde Google Drive

1. Sube la imagen a Google Drive.
2. Haz clic derecho → **Compartir** → cambia el acceso a **"Cualquier persona con el enlace puede ver"**.
3. Copia el enlace de compartir. Tendrá el formato:
   ```
   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
   ```
4. Pega esa URL en la columna 7 de tu hoja de cálculo.

La aplicación convierte automáticamente la URL de compartir a una URL de visualización directa, por lo que **no necesitas modificar el enlace**.

> **Nota:** Si la imagen no aparece, verifica que los permisos de Google Drive sean públicos ("Cualquier persona con el enlace"). Las imágenes con acceso restringido no se cargarán.

### Otras fuentes de imágenes

También puedes usar URLs directas de otras fuentes (Imgur, Cloudinary, etc.) siempre que sean accesibles públicamente y terminen en una extensión de imagen común (`.jpg`, `.png`, `.webp`, etc.).

## Stack

- HTML/CSS/JS (single file)
- Supabase (base de datos + autenticación + realtime)
- Tailwind CSS (via CDN)
- Vercel (hosting)

## Ramas

- `main` → versión quiz-only (sin login, sin exámenes)
- `v2` → esta versión (quiz + examen + login + imágenes en preguntas)

## Requisitos

Necesitas estar registrado como usuario autorizado en Supabase para acceder a la aplicación.
