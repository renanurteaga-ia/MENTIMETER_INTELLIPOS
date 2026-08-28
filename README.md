# IntelliPOS Interactive 2.0 — v2

Versión completa con cuestionarios, exámenes y sistema de login.

## Funcionalidades
- Cuestionarios en vivo con resultados en tiempo real
- Modo examen con orden aleatorio de preguntas (anti-copia)
- Login con autenticación Supabase Auth
- Control de acceso por lista de usuarios autorizados
- Participantes identificados por nickname

## Stack
- HTML/CSS/JS (single file)
- Supabase (base de datos + autenticación + realtime)
- Tailwind CSS (via CDN)
- Vercel (hosting)

## Ramas
- `main` → versión quiz-only (sin login, sin exámenes)
- `v2` → esta versión (quiz + examen + login)

## Requisitos
Necesitas estar registrado como usuario autorizado en Supabase para acceder a la aplicación.
