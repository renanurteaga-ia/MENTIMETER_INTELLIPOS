-- IntelliPOS Quiz — v3.1
-- Crea la columna que faltaba en session_results. Sin ella, ningún resultado
-- se guardaba desde el 20 de septiembre de 2026 (la inserción fallaba completa).
alter table public.session_results
  add column if not exists rangos_dim_obtenidos jsonb;

-- Refrescar la caché de la API para que la columna esté disponible al instante
notify pgrst, 'reload schema';
