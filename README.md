# ⚡ IntelliPOS Interactive

**Evaluaciones y Cuestionarios Interactivos en Tiempo Real.**

Sistema de participación en vivo diseñado para que un presentador lance preguntas y los asistentes respondan desde sus dispositivos móviles, viendo los resultados actualizarse al instante. Perfecto para aulas, talleres o eventos interactivos.

---

## 🚀 Demo Rápida
1. **Presentador:** Pega las preguntas desde Google Sheets, crea la sesión y comparte el código QR.
2. **Participante:** Escanea el QR desde su móvil y responde en tiempo real.
3. **Resultados:** El presentador ve las respuestas y estadísticas al momento.

---

## ✨ Características Principales
- **Carga masiva desde Google Sheets**: Copia y pega tus preguntas directamente desde una hoja de cálculo.
- **Modo Presentador**: Control total sobre el cuestionario (siguiente/anterior, revelar respuesta correcta, gráficos en vivo).
- **Modo Participante (Mobile First)**: Interfaz optimizada para teléfonos, con votación en tiempo real.
- **Sincronización en Vivo con Supabase**: Todos los votos y el estado de la sesión se actualizan al instante.
- **Código QR Automático**: Los participantes se unen escaneando el QR que genera la app.
- **Gráficos Dinámicos con Chart.js**: Visualización clara de los resultados por pregunta.
- **Detección de Voto Único**: Un dispositivo solo puede votar una vez por pregunta (usando `localStorage`).

---

## 🛠️ Tecnologías Utilizadas
- **Frontend**: HTML5, CSS3 (Tailwind CSS), JavaScript (ES6+).
- **Base de Datos / Backend**: Supabase (PostgreSQL) para la sincronización en tiempo real.
- **Gráficos**: Chart.js para visualización de datos.
- **QR**: QuickChart.io para generación automática de códigos QR.
- **Iconos**: FontAwesome.

---

## 📋 ¿Cómo Usarlo? (Guía Rápida para el Presentador)

1. **Prepara tus preguntas en Google Sheets** con las columnas:  
   `Pregunta | Opción A | Opción B | Opción C | Opción D | Correcta (A/B/C/D)`
2. **Copia** el rango de celdas que contiene tus preguntas.
3. **Abre la aplicación** y pega el contenido en el cuadro de texto.
4. Haz clic en **"Crear Sesión en Vivo"**.
5. ¡Comparte el código QR o el enlace con tus participantes!

> ⚠️ **Importante:** Este proyecto utiliza una instancia de Supabase para la sincronización. Si deseas usarlo de forma independiente, deberás crear tu propio proyecto en Supabase y actualizar las credenciales (`SUPABASE_URL` y `SUPABASE_KEY`) en el archivo `index.html`.

---

## 📁 Estructura del Proyecto
El proyecto es **Single Page Application (SPA)** y reside completamente en un solo archivo:
