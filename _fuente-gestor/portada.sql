-- Foto de portada del proyecto (26/11/2026)
-- archivos.favorita: la foto general del proyecto marcada con estrella es la portada de la tarjeta.
alter table public.archivos add column if not exists favorita boolean not null default false;

-- Marca (o desmarca) una foto general del proyecto como favorita; deja una sola por proyecto.
create or replace function public.marcar_portada(p_archivo uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare a public.archivos; nuevo boolean;
begin
  select * into a from public.archivos where id = p_archivo;
  if a.id is null or a.unidad_id is not null or a.proyecto_id is null then raise exception 'Archivo no encontrado'; end if;
  if not (es_agente() and mi_permiso('archivos_subir') and ve_proyecto(a.proyecto_id)) then raise exception 'Sin permiso para cambiar la portada'; end if;
  nuevo := not a.favorita;
  update public.archivos set favorita = false where proyecto_id = a.proyecto_id and unidad_id is null and favorita and id <> a.id;
  update public.archivos set favorita = nuevo where id = a.id;
  perform public.registrar(case when nuevo then 'Portada del proyecto: ' || a.nombre else 'Se quitó la foto favorita del proyecto' end, null, a.proyecto_id);
  return nuevo;
end $$;
revoke all on function public.marcar_portada(uuid) from public, anon;
grant execute on function public.marcar_portada(uuid) to authenticated;
