-- ════════════════════════════════════════════════════════════════════════════
-- IntelliPOS Quiz — Cursos y dictados (v3.6)
-- Ejecutar UNA VEZ en Supabase → SQL Editor → New query → Run.
-- Es seguro ejecutarlo más de una vez: no borra ni modifica datos existentes.
--
-- Modelo:
--   curso    (ej. "Accountability")              → carpeta de Drive del curso
--   └── dictado (cada vez que se dicta: "2026-II · Sección A")
--
--   quizzes.curso_id      → curso al que pertenece el cuestionario
--   quizzes.dictado_id    → dictado concreto (NULL = sirve para todos los dictados del curso)
--   quizzes.tipo_prueba   → 'parcial' | 'final' | 'practica' | NULL (sin especificar)
--   participant_lists.curso_id / dictado_id → curso y dictado de la lista
--
-- Los cuestionarios y listas existentes quedan "sin curso" hasta que los asignes.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Cursos
create table if not exists public.cursos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  descripcion  text,
  drive_url    text,                       -- enlace a la carpeta del curso en Drive
  creado_en    timestamptz not null default now()
);

-- 2) Dictados (cada vez que se dicta un curso)
create table if not exists public.dictados (
  id            uuid primary key default gen_random_uuid(),
  curso_id      uuid not null references public.cursos(id) on delete cascade,
  nombre        text not null,             -- ej. "2026-II · Sección A"
  fecha_inicio  date,
  fecha_fin     date,
  creado_en     timestamptz not null default now()
);
create index if not exists dictados_curso_idx on public.dictados(curso_id);

-- 3) Vincular cuestionarios
alter table public.quizzes
  add column if not exists curso_id    uuid references public.cursos(id)   on delete set null,
  add column if not exists dictado_id  uuid references public.dictados(id) on delete set null,
  add column if not exists tipo_prueba text;

do $$ begin
  alter table public.quizzes
    add constraint quizzes_tipo_prueba_chk
    check (tipo_prueba is null or tipo_prueba in ('parcial','final','practica'));
exception when duplicate_object then null; end $$;

create index if not exists quizzes_curso_idx   on public.quizzes(curso_id);
create index if not exists quizzes_dictado_idx on public.quizzes(dictado_id);

-- 4) Vincular listas de participantes
alter table public.participant_lists
  add column if not exists curso_id   uuid references public.cursos(id)   on delete set null,
  add column if not exists dictado_id uuid references public.dictados(id) on delete set null;

create index if not exists plists_curso_idx   on public.participant_lists(curso_id);
create index if not exists plists_dictado_idx on public.participant_lists(dictado_id);

-- 5) Permisos (RLS). Mismo nivel de acceso que hoy tienen las páginas de
--    preparación (quiz-prep / student-list-prep), que usan la clave pública.
alter table public.cursos   enable row level security;
alter table public.dictados enable row level security;

drop policy if exists "cursos_app_all"   on public.cursos;
drop policy if exists "dictados_app_all" on public.dictados;
create policy "cursos_app_all"   on public.cursos   for all to anon, authenticated using (true) with check (true);
create policy "dictados_app_all" on public.dictados for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.cursos, public.dictados to anon, authenticated;

-- Refrescar la caché de la API para que las tablas y columnas estén disponibles al instante
notify pgrst, 'reload schema';
