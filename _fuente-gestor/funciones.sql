drop function if exists public.guardar_local(text, jsonb);
drop function if exists public.registrar(text, text);
drop function if exists public.reservar(text[], jsonb, uuid);
drop function if exists public.cerrar_reserva(uuid, text);
drop function if exists public.crear_presupuesto(jsonb);
drop function if exists public.estado_presupuesto(uuid, text);

create or replace function public.registrar(p_texto text, p_unidad text default null, p_proyecto uuid default null) returns void
language plpgsql security invoker set search_path = public as $$
begin
  insert into public.historial(texto, unidad_id, proyecto_id, usuario_id, usuario)
  values (p_texto, p_unidad, coalesce(p_proyecto, (select proyecto_id from public.unidades where id = p_unidad)), auth.uid(), public.mi_nombre());
end $$;

-- Guardar una unidad desde su ficha (solo cambia los campos que vienen)
create or replace function public.guardar_unidad(p_id text, c jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare u public.unidades; cambios text[] := '{}'; nuevo_usd numeric; nuevo_pl numeric;
begin
  perform public.exigir_agente();
  select * into u from public.unidades where id = p_id for update;
  if not found then raise exception 'No existe la unidad'; end if;
  nuevo_usd := case when c ? 'usd_m2' then nullif(c->>'usd_m2','')::numeric else u.usd_m2 end;
  nuevo_pl := case when c ? 'precio_lista' then nullif(c->>'precio_lista','')::numeric else u.precio_lista end;
  if c ? 'estado' and c->>'estado' <> u.estado then cambios := cambios || ('estado ' || public.estado_txt(u.estado) || ' → ' || public.estado_txt(c->>'estado')); end if;
  if nuevo_usd is distinct from u.usd_m2 then cambios := cambios || ('USD/m² ' || coalesce(u.usd_m2::text,'—') || ' → ' || coalesce(nuevo_usd::text,'—')); end if;
  if nuevo_pl is distinct from u.precio_lista then cambios := cambios || ('precio ' || coalesce(u.precio_lista::text,'—') || ' → ' || coalesce(nuevo_pl::text,'—')); end if;
  if c ? 'cliente' and coalesce(c->>'cliente','') <> u.cliente then cambios := cambios || ('cliente: ' || coalesce(nullif(c->>'cliente',''),'(vacío)')); end if;
  if c ? 'rubro' and coalesce(c->>'rubro','') <> u.rubro then cambios := cambios || ('destino: ' || coalesce(nullif(c->>'rubro',''),'(vacío)')); end if;
  update public.unidades set
    codigo = coalesce(nullif(c->>'codigo',''), codigo),
    grupo = coalesce(c->>'grupo', grupo), subgrupo = coalesce(c->>'subgrupo', subgrupo), tipo = coalesce(c->>'tipo', tipo),
    m2 = coalesce(nullif(c->>'m2','')::numeric, m2),
    usd_m2 = nuevo_usd, precio_lista = nuevo_pl,
    estado = coalesce(c->>'estado', estado), cliente = coalesce(c->>'cliente', cliente), rubro = coalesce(c->>'rubro', rubro), notas = coalesce(c->>'notas', notas),
    ambientes = case when c ? 'ambientes' then nullif(c->>'ambientes','')::int else ambientes end,
    dormitorios = case when c ? 'dormitorios' then nullif(c->>'dormitorios','')::int else dormitorios end,
    banos = case when c ? 'banos' then nullif(c->>'banos','')::int else banos end,
    m2_cubiertos = case when c ? 'm2_cubiertos' then nullif(c->>'m2_cubiertos','')::numeric else m2_cubiertos end,
    m2_semicubiertos = case when c ? 'm2_semicubiertos' then nullif(c->>'m2_semicubiertos','')::numeric else m2_semicubiertos end,
    m2_terreno = case when c ? 'm2_terreno' then nullif(c->>'m2_terreno','')::numeric else m2_terreno end,
    frente = case when c ? 'frente' then nullif(c->>'frente','')::numeric else frente end,
    fondo = case when c ? 'fondo' then nullif(c->>'fondo','')::numeric else fondo end,
    orientacion = coalesce(c->>'orientacion', orientacion), cochera = coalesce(c->>'cochera', cochera),
    actualizado = now(), actualizado_por = auth.uid()
  where id = p_id;
  if array_length(cambios,1) > 0 then perform public.registrar(u.codigo || ': ' || array_to_string(cambios, ', '), u.id, u.proyecto_id); end if;
end $$;

create or replace function public.crear_presupuesto(p jsonb) returns public.presupuestos
language plpgsql security invoker set search_path = public as $$
declare r public.presupuestos; yo public.perfiles;
begin
  perform public.exigir_agente();
  select * into yo from public.perfiles where id = auth.uid();
  insert into public.presupuestos(proyecto_id, cliente_id, fecha, cliente, contacto, vigencia, estado, cond, items, notas, asesor_id, asesor)
  values ((p->>'proyecto_id')::uuid, nullif(p->>'cliente_id','')::uuid, coalesce((p->>'fecha')::date, current_date), coalesce(p->>'cliente',''), coalesce(p->>'contacto',''), (p->>'vigencia')::date, 'abierto',
          coalesce(p->'cond','{}'::jsonb), coalesce(p->'items','[]'::jsonb), coalesce(p->>'notas',''), auth.uid(),
          jsonb_build_object('nombre', public.mi_nombre(), 'telefono', yo.telefono, 'email', yo.email))
  returning * into r;
  if r.cliente_id is not null then
    update public.clientes set estado = case when estado in ('nuevo','contactado','visita') then 'negociacion' else estado end, actualizado = now() where id = r.cliente_id;
    insert into public.seguimientos(cliente_id, tipo, texto) values (r.cliente_id, 'nota', 'Se le armó el presupuesto CB-' || lpad(r.nro::text,4,'0') || ': ' || (select string_agg(x->>'codigo', ', ') from jsonb_array_elements(r.items) x));
  end if;
  perform public.registrar('Presupuesto CB-' || lpad(r.nro::text,4,'0') || ' para ' || coalesce(nullif(r.cliente,''),'sin cliente') || ': ' ||
    (select string_agg(x->>'codigo', ', ') from jsonb_array_elements(r.items) x), null, r.proyecto_id);
  return r;
end $$;

create or replace function public.estado_presupuesto(p_id uuid, p_estado text) returns void
language plpgsql security invoker set search_path = public as $$
declare r public.presupuestos;
begin
  perform public.exigir_agente();
  update public.presupuestos set estado = p_estado where id = p_id returning * into r;
  if not found then raise exception 'No existe el presupuesto'; end if;
  perform public.registrar('Presupuesto CB-' || lpad(r.nro::text,4,'0') || ' (' || coalesce(nullif(r.cliente,''),'sin cliente') || ') marcado como ' || p_estado, null, r.proyecto_id);
end $$;

create or replace function public.reservar(p_ids text[], d jsonb, p_presu uuid default null) returns void
language plpgsql security invoker set search_path = public as $$
declare u public.unidades; pr public.presupuestos; nro text := ''; cli uuid := nullif(d->>'cliente_id','')::uuid; pid uuid;
begin
  perform public.exigir_agente();
  if p_presu is not null then select * into pr from public.presupuestos where id = p_presu; if found then nro := 'CB-' || lpad(pr.nro::text,4,'0'); cli := coalesce(cli, pr.cliente_id); end if; end if;
  if (select count(*) from public.unidades where id = any(p_ids)) <> coalesce(array_length(p_ids,1),0) then raise exception 'Alguna unidad no existe'; end if;
  if (select count(distinct proyecto_id) from public.unidades where id = any(p_ids)) > 1 then raise exception 'Las unidades tienen que ser del mismo proyecto'; end if;
  for u in select * from public.unidades where id = any(p_ids) order by id for update loop
    if u.estado <> 'disponible' then raise exception 'La unidad % ya no está disponible', u.codigo; end if;
    pid := u.proyecto_id;
  end loop;
  for u in select * from public.unidades where id = any(p_ids) order by orden loop
    insert into public.reservas(proyecto_id, cliente_id, fecha, unidad_id, codigo, cliente, contacto, precio, sena, vence, estado, presupuesto_id, presupuesto_nro, notas, documento, asesor_id, asesor)
    values (u.proyecto_id, cli, coalesce((d->>'fecha')::date, current_date), u.id, u.codigo, coalesce(d->>'cliente',''), coalesce(d->>'contacto',''), u.precio,
            coalesce(nullif(d->>'sena','')::numeric,0), (d->>'vence')::date, 'activa', p_presu, nro, coalesce(d->>'notas',''), d->'documento', auth.uid(), public.mi_nombre());
    update public.unidades set estado = 'reservado', cliente = coalesce(d->>'cliente',''), actualizado = now(), actualizado_por = auth.uid() where id = u.id;
    perform public.registrar('Reserva de ' || u.codigo || ' para ' || coalesce(d->>'cliente','') || case when nro <> '' then ' (presupuesto ' || nro || ')' else '' end, u.id, u.proyecto_id);
  end loop;
  if p_presu is not null then update public.presupuestos set estado = 'aceptado' where id = p_presu; end if;
  if cli is not null then
    update public.clientes set estado = 'reservo', actualizado = now() where id = cli and estado <> 'compro';
    insert into public.seguimientos(cliente_id, tipo, texto) values (cli, 'nota', 'Reservó ' || (select string_agg(codigo, ', ') from public.unidades where id = any(p_ids)));
  end if;
end $$;

create or replace function public.cerrar_reserva(p_id uuid, p_tipo text) returns void
language plpgsql security invoker set search_path = public as $$
declare r public.reservas;
begin
  perform public.exigir_agente();
  select * into r from public.reservas where id = p_id for update;
  if not found then raise exception 'No existe la reserva'; end if;
  if r.estado <> 'activa' then raise exception 'La reserva ya estaba cerrada'; end if;
  if p_tipo = 'firmada' then
    update public.reservas set estado = 'firmada', cerrada = current_date where id = p_id;
    update public.unidades set estado = 'vendido', cliente = r.cliente, actualizado = now(), actualizado_por = auth.uid() where id = r.unidad_id;
    perform public.registrar(r.codigo || ' vendida a ' || r.cliente || ' (boleto firmado)', r.unidad_id, r.proyecto_id);
    if r.cliente_id is not null then update public.clientes set estado = 'compro', actualizado = now() where id = r.cliente_id; end if;
  elsif p_tipo = 'caida' then
    update public.reservas set estado = 'caida', cerrada = current_date where id = p_id;
    update public.unidades set estado = 'disponible', cliente = '', actualizado = now(), actualizado_por = auth.uid() where id = r.unidad_id;
    perform public.registrar('Se cayó la reserva de ' || r.codigo || ' (' || r.cliente || '). Vuelve a estar disponible', r.unidad_id, r.proyecto_id);
    if r.cliente_id is not null then update public.clientes set estado = 'negociacion', actualizado = now() where id = r.cliente_id and estado = 'reservo'; end if;
  else raise exception 'Tipo inválido';
  end if;
end $$;

-- Plan de pagos: anticipo + N cuotas mensuales (se puede rehacer mientras no haya pagos)
create or replace function public.generar_plan(p_reserva uuid, p_anticipo numeric, p_venc_anticipo date, p_cuotas int, p_monto_cuota numeric, p_primer date) returns int
language plpgsql security definer set search_path = public as $$
declare r public.reservas; i int;
begin
  perform public.exigir_agente();
  select * into r from public.reservas where id = p_reserva;
  if not found then raise exception 'No existe la reserva'; end if;
  if exists(select 1 from public.cuotas where reserva_id = p_reserva and pagado > 0) then raise exception 'Este plan ya tiene pagos registrados: no se puede rehacer'; end if;
  if coalesce(p_cuotas,0) < 0 or coalesce(p_cuotas,0) > 240 then raise exception 'Cantidad de cuotas inválida'; end if;
  delete from public.cuotas where reserva_id = p_reserva;
  if coalesce(p_anticipo,0) > 0 then
    insert into public.cuotas(reserva_id, proyecto_id, unidad_id, cliente, numero, concepto, vencimiento, monto)
    values (r.id, r.proyecto_id, r.unidad_id, r.cliente, 0, 'Anticipo', coalesce(p_venc_anticipo, current_date), p_anticipo);
  end if;
  for i in 1..coalesce(p_cuotas,0) loop
    insert into public.cuotas(reserva_id, proyecto_id, unidad_id, cliente, numero, concepto, vencimiento, monto)
    values (r.id, r.proyecto_id, r.unidad_id, r.cliente, i, 'Cuota ' || i || ' de ' || p_cuotas, (p_primer + ((i-1) || ' month')::interval)::date, p_monto_cuota);
  end loop;
  perform public.registrar('Plan de pagos de ' || r.codigo || ' (' || r.cliente || '): ' || case when coalesce(p_anticipo,0) > 0 then 'anticipo USD ' || p_anticipo || ' + ' else '' end || coalesce(p_cuotas,0) || ' cuotas de USD ' || coalesce(p_monto_cuota,0), r.unidad_id, r.proyecto_id);
  return coalesce(p_cuotas,0);
end $$;

create or replace function public.registrar_pago(p_cuota uuid, p_monto numeric, p_fecha date, p_nota text default '') returns void
language plpgsql security invoker set search_path = public as $$
declare c public.cuotas;
begin
  perform public.exigir_agente();
  if coalesce(p_monto,0) = 0 then raise exception 'Poné el monto pagado'; end if;
  update public.cuotas set pagado = greatest(0, pagado + p_monto), fecha_pago = coalesce(p_fecha, current_date),
    notas = trim(both ' ' from notas || case when coalesce(p_nota,'') <> '' then ' · ' || p_nota else '' end)
  where id = p_cuota returning * into c;
  if not found then raise exception 'No existe la cuota'; end if;
  perform public.registrar('Pago de ' || c.concepto || ' · ' || (select codigo from public.unidades where id = c.unidad_id) || ' (' || c.cliente || '): USD ' || p_monto, c.unidad_id, c.proyecto_id);
end $$;

revoke execute on function public.registrar(text, text, uuid), public.guardar_unidad(text, jsonb), public.crear_presupuesto(jsonb), public.estado_presupuesto(uuid, text),
  public.reservar(text[], jsonb, uuid), public.cerrar_reserva(uuid, text), public.generar_plan(uuid, numeric, date, int, numeric, date), public.registrar_pago(uuid, numeric, date, text) from public, anon;
grant execute on function public.registrar(text, text, uuid), public.guardar_unidad(text, jsonb), public.crear_presupuesto(jsonb), public.estado_presupuesto(uuid, text),
  public.reservar(text[], jsonb, uuid), public.cerrar_reserva(uuid, text), public.generar_plan(uuid, numeric, date, int, numeric, date), public.registrar_pago(uuid, numeric, date, text) to authenticated;
