-- Vista previa pública para WhatsApp (26/11/2026), aplicada en Supabase tfnaacvzjtamjgkzofeh
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publico', 'publico', true, 1048576, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];
create policy publico_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'publico' and es_agente() and name ~ '^proyectos/[0-9a-f-]{36}\.jpg$' and ve_proyecto(substring(name from 11 for 36)::uuid));
create policy publico_actualizar on storage.objects for update to authenticated
  using (bucket_id = 'publico' and es_agente() and ve_proyecto(substring(name from 11 for 36)::uuid))
  with check (bucket_id = 'publico' and es_agente() and name ~ '^proyectos/[0-9a-f-]{36}\.jpg$' and ve_proyecto(substring(name from 11 for 36)::uuid));
create policy publico_ver on storage.objects for select to authenticated using (bucket_id = 'publico' and es_agente());
create or replace function public.proyectos_publicos()
returns table(id uuid, nombre text, tipo text, localidad text, desarrolladora text, descripcion text)
language sql stable security definer set search_path = public as $$
  select id, nombre, tipo, localidad, desarrolladora, descripcion from public.proyectos where coalesce(estado, '') <> 'archivado' order by orden, creado;
$$;
grant execute on function public.proyectos_publicos() to anon, authenticated;
