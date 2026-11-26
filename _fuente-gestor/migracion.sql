-- ============ Gestor de desarrollos: proyectos, unidades genéricas, clientes y cuotas ============

create table public.proyectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null default 'edificio' check (tipo in ('edificio','barrio','condominio','comercial','otro')),
  direccion text not null default '',
  localidad text not null default '',
  desarrolladora text not null default '',
  descripcion text not null default '',
  estado text not null default 'activo' check (estado in ('activo','archivado')),
  niveles jsonb not null default '{"grupo":"Torre","subgrupo":"Piso","unidad":"Unidad"}'::jsonb,
  cond jsonb not null default '{"anticipoPct":30,"cuotas":36,"honorariosPct":4,"certificacionArs":0,"vigenciaDias":30}'::jsonb,
  doc jsonb not null default '{}'::jsonb,
  orden int not null default 0,
  creado timestamptz not null default now()
);

-- Proyecto inicial: Paseo de Compras Black
insert into public.proyectos(id, nombre, tipo, direccion, localidad, desarrolladora, descripcion, niveles, cond, doc, orden)
values ('00000000-0000-4000-8000-000000000001', 'Paseo de Compras Black', 'comercial', 'Santa Teresa 2560, entre San Miguel e Islandia', 'Escobar, Zona Puertos', 'Fideicomiso Inmobiliario Black', 'Venta de pozo de locales comerciales y oficinas.',
  '{"grupo":"Planta","subgrupo":"Nave","unidad":"Local","nombres":{"PB":"Planta baja","1":"Primer nivel","2":"Segundo nivel"},"frases":{"PB":"la Planta Baja situada","1":"el Primer Nivel situado","2":"el Segundo Nivel situado"}}'::jsonb,
  coalesce((select valor from public.config where clave='condiciones'), '{"anticipoPct":30,"cuotas":36,"honorariosPct":4,"certificacionArs":160000,"vigenciaDias":30}'::jsonb),
  jsonb_build_object(
    'fideicomiso','FIDEICOMISO INMOBILIARIO BLACK',
    'cuit','30-71866388-8',
    'constituido','5 de marzo de 2024',
    'emprendimiento','PASEO DE COMPRAS BLACK',
    'emprendimientoCorto','BLACK Paseo de Compras',
    'ubicacion','ubicado en la calle Santa Teresa N°2560 entre San Miguel e Islandia; designado según su título como Lote 2 de la fracción H, Nomenclatura catastral: Circunscripción XII, Sección R, Quinta 5, Parcela 7, Partida Inmobiliaria: 118- 039020-1, Matricula 7423 de Escobar, provincia de Buenos Aires',
    'banco','la Sucursal del Banco Macro Nordelta, Tigre, Provincia de Buenos Aires',
    'escribano','el escribano Christian José MANZELLA, Registro 41 del Partido de Vicente López, con domicilio en la Avenida Guillermo Rawson número 3415, de La Lucila, Partido de Vicente López, Provincia de Buenos Aires, Teléfono 7078-8800, correo electrónico: cjm@escribaniamanzella.com',
    'domicilioVendedora','la calle MATURIN número 2655, planta baja, departamento "2", de la Ciudad Autónoma de Buenos Aires',
    'diasBoleto',10, 'honorarios',3, 'montoReserva',10000), 1);

-- ============ Unidades (antes "locales") ============
alter table public.locales rename to unidades;
alter table public.unidades add column proyecto_id uuid references public.proyectos(id) on delete cascade;
update public.unidades set proyecto_id = '00000000-0000-4000-8000-000000000001';
alter table public.unidades alter column proyecto_id set not null;
alter table public.unidades drop constraint if exists locales_planta_check;
alter table public.unidades rename column planta to grupo;
alter table public.unidades rename column nave to subgrupo;
alter table public.unidades alter column subgrupo type text using subgrupo::text;
alter table public.unidades alter column subgrupo set default '';
alter table public.unidades alter column grupo set default '';
alter table public.unidades alter column id set default gen_random_uuid()::text;
alter table public.unidades
  add column tipo text not null default '',
  add column ambientes int, add column dormitorios int, add column banos int,
  add column m2_cubiertos numeric(10,2), add column m2_semicubiertos numeric(10,2), add column m2_terreno numeric(10,2),
  add column frente numeric(10,2), add column fondo numeric(10,2),
  add column orientacion text not null default '', add column cochera text not null default '',
  add column precio_lista numeric(14,2),
  add column extras jsonb not null default '{}'::jsonb;
alter table public.unidades drop column precio;
alter table public.unidades add column precio numeric(14,2) generated always as (coalesce(precio_lista, case when usd_m2 is null then null else round(m2*usd_m2,2) end)) stored;
create unique index unidades_proyecto_codigo on public.unidades(proyecto_id, codigo);
create index unidades_proyecto on public.unidades(proyecto_id, orden);

-- ============ Proyecto en el resto de las tablas ============
alter table public.presupuestos add column proyecto_id uuid references public.proyectos(id) on delete cascade;
update public.presupuestos set proyecto_id = '00000000-0000-4000-8000-000000000001';
alter table public.reservas add column proyecto_id uuid references public.proyectos(id) on delete cascade;
update public.reservas set proyecto_id = '00000000-0000-4000-8000-000000000001';
alter table public.reservas rename column local_id to unidad_id;
alter table public.historial add column proyecto_id uuid references public.proyectos(id) on delete cascade;
update public.historial set proyecto_id = '00000000-0000-4000-8000-000000000001';
alter table public.historial rename column local_id to unidad_id;
alter table public.comentarios rename column local_id to unidad_id;
alter table public.archivos rename column local_id to unidad_id;
alter table public.archivos add column proyecto_id uuid references public.proyectos(id) on delete cascade;
update public.archivos a set proyecto_id = u.proyecto_id from public.unidades u where u.id = a.unidad_id;
create index on public.presupuestos(proyecto_id);
create index on public.reservas(proyecto_id);
create index on public.historial(proyecto_id, ts desc);
create index on public.archivos(proyecto_id);

-- ============ Clientes interesados y seguimiento ============
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid references public.proyectos(id) on delete set null,
  nombre text not null check (length(nombre) between 1 and 200),
  telefono text not null default '', email text not null default '', documento text not null default '',
  origen text not null default '',
  estado text not null default 'nuevo' check (estado in ('nuevo','contactado','visita','negociacion','reservo','compro','perdido')),
  interes text not null default '',
  presupuesto_max numeric(14,2),
  proximo date,
  notas text not null default '',
  asesor_id uuid references public.perfiles(id) on delete set null default auth.uid(),
  asesor text not null default '',
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index on public.clientes(proyecto_id, estado);
create table public.seguimientos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo text not null default 'nota' check (tipo in ('nota','llamada','whatsapp','email','visita','reunion')),
  texto text not null check (length(texto) between 1 and 4000),
  autor_id uuid references public.perfiles(id) on delete set null default auth.uid(),
  autor text not null default '',
  creado timestamptz not null default now()
);
create index on public.seguimientos(cliente_id, creado desc);
alter table public.reservas add column cliente_id uuid references public.clientes(id) on delete set null;
alter table public.presupuestos add column cliente_id uuid references public.clientes(id) on delete set null;

-- ============ Plan de pagos y cobranzas ============
create table public.cuotas (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete cascade,
  unidad_id text,
  cliente text not null default '',
  numero int not null default 0,
  concepto text not null default 'Cuota',
  vencimiento date not null,
  monto numeric(14,2) not null check (monto >= 0),
  pagado numeric(14,2) not null default 0,
  fecha_pago date,
  notas text not null default '',
  creado timestamptz not null default now()
);
create index on public.cuotas(proyecto_id, vencimiento);
create index on public.cuotas(reserva_id, numero);

-- ============ Permisos ============
alter table public.proyectos enable row level security;
alter table public.clientes enable row level security;
alter table public.seguimientos enable row level security;
alter table public.cuotas enable row level security;
create policy proy_ver on public.proyectos for select to authenticated using (public.es_agente());
create policy proy_admin on public.proyectos for all to authenticated using (public.es_admin()) with check (public.es_admin());
-- unidades: altas y bajas solo admin (ya estaban así); agentes editan
create policy cli_ver on public.clientes for select to authenticated using (public.es_agente());
create policy cli_alta on public.clientes for insert to authenticated with check (public.es_agente());
create policy cli_editar on public.clientes for update to authenticated using (public.es_agente()) with check (public.es_agente());
create policy cli_baja on public.clientes for delete to authenticated using (public.es_admin() or asesor_id = auth.uid());
create policy seg_ver on public.seguimientos for select to authenticated using (public.es_agente());
create policy seg_alta on public.seguimientos for insert to authenticated with check (public.es_agente() and autor_id = auth.uid());
create policy seg_baja on public.seguimientos for delete to authenticated using (autor_id = auth.uid() or public.es_admin());
create policy cuo_ver on public.cuotas for select to authenticated using (public.es_agente());
create policy cuo_editar on public.cuotas for update to authenticated using (public.es_agente()) with check (public.es_agente());
create policy cuo_alta on public.cuotas for insert to authenticated with check (public.es_agente());
create policy cuo_admin on public.cuotas for delete to authenticated using (public.es_admin());
revoke all on public.proyectos, public.clientes, public.seguimientos, public.cuotas from anon;
create or replace function public.poner_asesor_cliente() returns trigger
language plpgsql security definer set search_path = public as $$
begin new.asesor := public.mi_nombre(); if new.asesor_id is null then new.asesor_id := auth.uid(); end if; return new; end $$;
revoke execute on function public.poner_asesor_cliente() from public, anon, authenticated;
create trigger clientes_autor before insert on public.clientes for each row execute function public.poner_asesor_cliente();
create trigger seguimientos_autor before insert on public.seguimientos for each row execute function public.poner_autor();
alter publication supabase_realtime add table public.proyectos, public.clientes, public.seguimientos, public.cuotas;
delete from public.config where clave = 'condiciones';
