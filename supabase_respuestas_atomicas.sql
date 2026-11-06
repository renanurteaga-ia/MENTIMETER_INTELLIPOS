-- ════════════════════════════════════════════════════════════════════════════
-- IntelliPOS Quiz — Registro ATÓMICO de respuestas (v2.9)
-- Ejecutar UNA VEZ en Supabase → SQL Editor → New query → Run.
--
-- Problema que resuelve: antes cada navegador descargaba quiz_session.data,
-- le sumaba su voto y lo volvía a subir completo. Si dos participantes
-- respondían a la vez, el último en escribir borraba la respuesta del otro.
-- Estas funciones hacen la modificación DENTRO de la base de datos, con el
-- registro bloqueado (FOR UPDATE), así que las escrituras simultáneas se
-- encolan y ninguna se pierde.
-- ════════════════════════════════════════════════════════════════════════════

-- 1) Registrar respuesta de un participante (MC, ponderada, nivel-rango, abierta, perfil)
create or replace function public.ipos_register_answer(
  p_session_id text,
  p_qidx       text,     -- índice de la pregunta (como texto)
  p_pid        text,     -- participantId
  p_answer     text,     -- 'A'..'D', nivel '1'..'5' o texto libre
  p_vote_key   text      -- clave a incrementar en votes (ej. '3_B'); null para abiertas
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d      jsonb;
  voters jsonb;
begin
  select data into d from quiz_session where id = p_session_id for update;
  if d is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  voters := coalesce(d #> array['voters', p_qidx], '[]'::jsonb);
  if voters ? p_pid then
    return jsonb_build_object('status', 'duplicate', 'data', d);
  end if;

  d := jsonb_set(d, '{voters}', coalesce(d->'voters', '{}'::jsonb), true);
  d := jsonb_set(d, array['voters', p_qidx], voters || to_jsonb(p_pid), true);

  if p_vote_key is not null then
    d := jsonb_set(d, '{votes}', coalesce(d->'votes', '{}'::jsonb), true);
    d := jsonb_set(d, array['votes', p_vote_key],
                   to_jsonb(coalesce((d #>> array['votes', p_vote_key])::int, 0) + 1), true);
  end if;

  d := jsonb_set(d, '{participantVotes}', coalesce(d->'participantVotes', '{}'::jsonb), true);
  d := jsonb_set(d, array['participantVotes', p_pid],
                 coalesce(d #> array['participantVotes', p_pid], '{}'::jsonb), true);
  d := jsonb_set(d, array['participantVotes', p_pid, p_qidx], to_jsonb(p_answer), true);

  update quiz_session set data = d where id = p_session_id;
  return jsonb_build_object('status', 'ok', 'data', d);
end;
$$;

-- 2) Registrar a un participante que entra a la sesión
create or replace function public.ipos_join_session(
  p_session_id text,
  p_pid        text,
  p_nick       text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d jsonb;
begin
  select data into d from quiz_session where id = p_session_id for update;
  if d is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  d := jsonb_set(d, '{participants}', coalesce(d->'participants', '{}'::jsonb), true);
  d := jsonb_set(d, array['participants', p_pid], to_jsonb(p_nick), true);
  update quiz_session set data = d where id = p_session_id;
  return jsonb_build_object('status', 'ok', 'data', d);
end;
$$;

-- 3) Entregar examen completo de un participante
create or replace function public.ipos_submit_exam(
  p_session_id text,
  p_pid        text,
  p_answers    jsonb     -- { "0": "A", "1": "C", ... }
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d jsonb;
begin
  select data into d from quiz_session where id = p_session_id for update;
  if d is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  d := jsonb_set(d, '{participantVotes}', coalesce(d->'participantVotes', '{}'::jsonb), true);
  d := jsonb_set(d, array['participantVotes', p_pid], coalesce(p_answers, '{}'::jsonb), true);
  d := jsonb_set(d, '{examSubmissions}', coalesce(d->'examSubmissions', '{}'::jsonb), true);
  d := jsonb_set(d, array['examSubmissions', p_pid],
                 jsonb_build_object('submittedAt', (extract(epoch from now()) * 1000)::bigint), true);
  update quiz_session set data = d where id = p_session_id;
  return jsonb_build_object('status', 'ok', 'data', d);
end;
$$;

-- 4) Cambios del presentador (pregunta actual, revelar, estado…).
--    Fusiona SOLO los campos enviados y nunca toca los que escriben los
--    participantes, para no borrar votos que lleguen en ese mismo instante.
create or replace function public.ipos_presenter_update(
  p_session_id text,
  p_patch      jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d jsonb;
begin
  select data into d from quiz_session where id = p_session_id for update;
  if d is null then
    return jsonb_build_object('status', 'not_found');
  end if;
  d := d || (p_patch - 'votes' - 'voters' - 'participants' - 'participantVotes' - 'examSubmissions');
  update quiz_session set data = d where id = p_session_id;
  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function public.ipos_register_answer(text, text, text, text, text) to anon, authenticated;
grant execute on function public.ipos_join_session(text, text, text)                to anon, authenticated;
grant execute on function public.ipos_submit_exam(text, text, jsonb)                to anon, authenticated;
grant execute on function public.ipos_presenter_update(text, jsonb)                 to anon, authenticated;

-- Refrescar la caché de la API para que las funciones estén disponibles al instante
notify pgrst, 'reload schema';
