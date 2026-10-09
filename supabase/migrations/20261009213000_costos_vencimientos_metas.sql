-- ============================================================
-- 9) Costos, vencimientos, mermas, proveedores, gastos fijos y metas
-- ============================================================
-- Todo esto es SOLO del dueño: el cajero no ve costos, ni proveedores, ni metas.
-- Las cantidades siguen la regla de siempre: gramos si el producto es 'peso', unidades si es 'unidad'.
-- Los costos se guardan por KILO (peso) o por UNIDAD, igual que los precios.

-- ---------- proveedores ----------
create table public.proveedores (
  id        bigint generated always as identity primary key,
  nombre    text not null check (length(trim(nombre)) > 0),
  telefono  text,
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);
create unique index proveedores_nombre_unico on public.proveedores (lower(trim(nombre))) where activo;

-- ---------- lotes: cada ingreso de mercadería, con su costo, vencimiento y estado de pago ----------
create table public.lotes_stock (
  id                    bigint generated always as identity primary key,
  movimiento_id         bigint not null unique references public.movimientos_stock (id),
  producto_id           bigint not null references public.productos (id),
  cantidad              integer not null check (cantidad > 0),
  costo_total_centavos  integer check (costo_total_centavos >= 0),   -- lo que se pagó por TODO el lote
  vence_el              date,
  proveedor_id          bigint references public.proveedores (id),
  pagado                boolean not null default true,
  pagar_hasta           date,
  pagado_en             timestamptz,
  creado_en             timestamptz not null default now(),
  constraint lote_pago_coherente check (pagado or pagado_en is null)
);
create index lotes_producto_idx   on public.lotes_stock (producto_id);
create index lotes_vence_idx      on public.lotes_stock (vence_el) where vence_el is not null;
create index lotes_impagos_idx    on public.lotes_stock (pagar_hasta) where not pagado;

-- ---------- gastos fijos mensuales (alquiler, luz, sueldos...) ----------
create table public.gastos_fijos (
  id             bigint generated always as identity primary key,
  nombre         text not null check (length(trim(nombre)) > 0),
  monto_centavos integer not null check (monto_centavos >= 0),
  activo         boolean not null default true,
  creado_en      timestamptz not null default now()
);

-- ---------- meta de ventas de cada mes ----------
create table public.metas_mensuales (
  mes            date primary key check (extract(day from mes) = 1),   -- siempre el día 1 del mes
  meta_centavos  integer not null check (meta_centavos > 0),
  actualizado_en timestamptz not null default now()
);

-- ---------- seguridad: solo el dueño, para todo ----------
alter table public.proveedores      enable row level security;
alter table public.lotes_stock      enable row level security;
alter table public.gastos_fijos     enable row level security;
alter table public.metas_mensuales  enable row level security;

create policy proveedores_dueno  on public.proveedores     for all to authenticated using (public.es_dueno()) with check (public.es_dueno());
create policy gastos_dueno       on public.gastos_fijos    for all to authenticated using (public.es_dueno()) with check (public.es_dueno());
create policy metas_dueno        on public.metas_mensuales for all to authenticated using (public.es_dueno()) with check (public.es_dueno());
-- Los lotes no se borran: solo se ven, se crean y se marcan pagados.
create policy lotes_ver      on public.lotes_stock for select to authenticated using (public.es_dueno());
create policy lotes_insertar on public.lotes_stock for insert to authenticated with check (public.es_dueno());
create policy lotes_pagar    on public.lotes_stock for update to authenticated using (public.es_dueno()) with check (public.es_dueno());

-- ---------- registrar_ingreso ----------
-- Suma stock + guarda el lote + (si hay costo) actualiza el costo del producto. Todo junto o nada.
-- Idempotente: la misma clave devuelve el movimiento ya registrado.
create function public.registrar_ingreso(
  p_producto_id          bigint,
  p_cantidad             integer,
  p_nota                 text,
  p_clave                uuid,
  p_costo_total_centavos integer,
  p_vence_el             date,
  p_proveedor_id         bigint,
  p_pagado               boolean,
  p_pagar_hasta          date
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario  uuid := auth.uid();
  v_hoy      date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_existente bigint;
  v_tipo     public.tipo_venta;
  v_mov      bigint;
  v_costo_unit bigint;
begin
  if v_usuario is null then raise exception 'sin_sesion' using errcode = '42501'; end if;
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  if p_clave is null then raise exception 'clave_obligatoria'; end if;

  select id into v_existente from public.movimientos_stock where clave_idempotencia = p_clave;
  if v_existente is not null then return v_existente; end if;

  if p_cantidad is null or p_cantidad <= 0 then raise exception 'cantidad_invalida'; end if;
  if p_costo_total_centavos is not null and p_costo_total_centavos < 0 then raise exception 'costo_invalido'; end if;
  if p_vence_el is not null and p_vence_el < v_hoy then raise exception 'vencimiento_pasado'; end if;
  if p_vence_el is not null and p_vence_el > v_hoy + 3650 then raise exception 'vencimiento_invalido'; end if;
  if coalesce(p_pagado, true) = false and p_costo_total_centavos is null then raise exception 'deuda_sin_costo'; end if;

  select tipo_venta into v_tipo from public.productos where id = p_producto_id and activo;
  if v_tipo is null then raise exception 'producto_no_encontrado'; end if;
  if p_proveedor_id is not null and not exists (select 1 from public.proveedores where id = p_proveedor_id and activo) then
    raise exception 'proveedor_no_encontrado';
  end if;

  insert into public.movimientos_stock (producto_id, tipo, cantidad, motivo, usuario_id, clave_idempotencia)
  values (p_producto_id, 'ingreso', p_cantidad, nullif(trim(coalesce(p_nota, '')), ''), v_usuario, p_clave)
  returning id into v_mov;

  insert into public.lotes_stock (movimiento_id, producto_id, cantidad, costo_total_centavos, vence_el, proveedor_id, pagado, pagar_hasta)
  values (v_mov, p_producto_id, p_cantidad, p_costo_total_centavos, p_vence_el, p_proveedor_id,
          coalesce(p_pagado, true), case when coalesce(p_pagado, true) then null else p_pagar_hasta end);

  -- Costo por kilo (peso) o por unidad, redondeado al centavo más cercano (mitad hacia arriba, solo enteros).
  if p_costo_total_centavos is not null then
    if v_tipo = 'peso' then
      v_costo_unit := (p_costo_total_centavos::bigint * 1000 * 2 + p_cantidad) / (2 * p_cantidad::bigint);
    else
      v_costo_unit := (p_costo_total_centavos::bigint * 2 + p_cantidad) / (2 * p_cantidad::bigint);
    end if;
    if v_costo_unit > 2147483647 then raise exception 'costo_fuera_de_rango'; end if;
    insert into public.costos_producto (producto_id, costo_centavos, creado_por)
    values (p_producto_id, v_costo_unit::integer, v_usuario);
  end if;

  return v_mov;
end;
$$;

-- ---------- registrar_merma ----------
-- Lo que se tira, se vence o se corta de más. p_cantidad va en POSITIVO; el libro lo guarda restando.
create function public.registrar_merma(
  p_producto_id bigint,
  p_cantidad    integer,
  p_motivo      text,
  p_clave       uuid
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_existente bigint;
  v_mov bigint;
begin
  if v_usuario is null then raise exception 'sin_sesion' using errcode = '42501'; end if;
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  if p_clave is null then raise exception 'clave_obligatoria'; end if;

  select id into v_existente from public.movimientos_stock where clave_idempotencia = p_clave;
  if v_existente is not null then return v_existente; end if;

  if p_cantidad is null or p_cantidad <= 0 then raise exception 'cantidad_invalida'; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'motivo_obligatorio'; end if;
  if not exists (select 1 from public.productos where id = p_producto_id and activo) then
    raise exception 'producto_no_encontrado';
  end if;

  insert into public.movimientos_stock (producto_id, tipo, cantidad, motivo, usuario_id, clave_idempotencia)
  values (p_producto_id, 'merma', -p_cantidad, trim(p_motivo), v_usuario, p_clave)
  returning id into v_mov;
  return v_mov;
end;
$$;

-- ---------- cambiar_precios ----------
-- p_cambios: [{"producto_id": 3, "precio": 1250000}, ...]  (centavos, por kilo o por unidad)
-- Inserta un precio nuevo por producto (el historial se conserva). Ignora los que no cambian.
-- Devuelve cuántos precios cambió.
create function public.cambiar_precios(p_cambios jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_item    jsonb;
  v_prod    bigint;
  v_precio  bigint;
  v_actual  integer;
  v_cuenta  integer := 0;
begin
  if v_usuario is null then raise exception 'sin_sesion' using errcode = '42501'; end if;
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  if p_cambios is null or jsonb_typeof(p_cambios) <> 'array' or jsonb_array_length(p_cambios) = 0 then
    raise exception 'cambios_invalidos';
  end if;
  if jsonb_array_length(p_cambios) > 500 then raise exception 'demasiados_cambios'; end if;

  for v_item in select * from jsonb_array_elements(p_cambios) loop
    if jsonb_typeof(v_item -> 'producto_id') <> 'number' or jsonb_typeof(v_item -> 'precio') <> 'number'
       or (v_item ->> 'producto_id') !~ '^\d+$' or (v_item ->> 'precio') !~ '^\d+$' then
      raise exception 'cambios_invalidos';
    end if;
    v_prod   := (v_item ->> 'producto_id')::bigint;
    v_precio := (v_item ->> 'precio')::bigint;
    if v_precio > 2147483647 then raise exception 'precio_fuera_de_rango'; end if;
    if not exists (select 1 from public.productos where id = v_prod and activo) then
      raise exception 'producto_no_encontrado';
    end if;

    select precio_centavos into v_actual
      from public.precios_producto
     where producto_id = v_prod and vigente_desde <= now()
     order by vigente_desde desc, id desc limit 1;

    if v_actual is distinct from v_precio::integer then
      insert into public.precios_producto (producto_id, precio_centavos, creado_por)
      values (v_prod, v_precio::integer, v_usuario);
      v_cuenta := v_cuenta + 1;
    end if;
  end loop;
  return v_cuenta;
end;
$$;

-- ---------- resumen de ganancia ----------
-- Solo cuenta lo vendido que TIENE costo conocido al momento de la venta (el último costo cargado
-- antes de esa venta). Lo que no tiene costo se informa aparte: no se inventa.
create function public.resumen_ganancia(p_desde date, p_hasta date)
returns table (
  ingresos_con_costo  bigint,   -- subtotal de los renglones con costo conocido
  costo_vendido       bigint,   -- lo que costó eso
  ingresos_sin_costo  bigint,   -- subtotal de los renglones SIN costo conocido
  descuentos          bigint    -- descuentos dados en el período
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 366 then
    raise exception 'rango_invalido';
  end if;

  return query
    with renglones as (
      select vi.subtotal_centavos,
             vi.cantidad,
             p.tipo_venta,
             c.costo_centavos
        from public.venta_items vi
        join public.ventas v on v.id = vi.venta_id
        join public.productos p on p.id = vi.producto_id
        left join lateral (
          select cp.costo_centavos
            from public.costos_producto cp
           where cp.producto_id = vi.producto_id and cp.vigente_desde <= v.creado_en
           order by cp.vigente_desde desc, cp.id desc
           limit 1
        ) c on true
       where v.estado = 'completada'
         and (v.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
    )
    select coalesce(sum(r.subtotal_centavos) filter (where r.costo_centavos is not null), 0)::bigint,
           coalesce(sum(case when r.tipo_venta = 'peso'
                             then round(r.cantidad::numeric * r.costo_centavos / 1000)
                             else r.cantidad::numeric * r.costo_centavos end)
                    filter (where r.costo_centavos is not null), 0)::bigint,
           coalesce(sum(r.subtotal_centavos) filter (where r.costo_centavos is null), 0)::bigint,
           (select coalesce(sum(v2.descuento_centavos), 0)::bigint
              from public.ventas v2
             where v2.estado = 'completada'
               and (v2.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta)
      from renglones r;
end;
$$;

-- ---------- margen por producto ----------
create function public.margen_por_producto(p_desde date, p_hasta date, p_limite integer)
returns table (
  producto_id         bigint,
  nombre              text,
  tipo_venta          public.tipo_venta,
  cantidad            bigint,
  ingresos_con_costo  bigint,
  costo_vendido       bigint,
  ingresos_sin_costo  bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 366 then
    raise exception 'rango_invalido';
  end if;

  return query
    with renglones as (
      select vi.producto_id, vi.subtotal_centavos, vi.cantidad, c.costo_centavos
        from public.venta_items vi
        join public.ventas v on v.id = vi.venta_id
        left join lateral (
          select cp.costo_centavos
            from public.costos_producto cp
           where cp.producto_id = vi.producto_id and cp.vigente_desde <= v.creado_en
           order by cp.vigente_desde desc, cp.id desc
           limit 1
        ) c on true
       where v.estado = 'completada'
         and (v.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
    )
    select p.id, p.nombre, p.tipo_venta,
           sum(r.cantidad)::bigint,
           coalesce(sum(r.subtotal_centavos) filter (where r.costo_centavos is not null), 0)::bigint,
           coalesce(sum(case when p.tipo_venta = 'peso'
                             then round(r.cantidad::numeric * r.costo_centavos / 1000)
                             else r.cantidad::numeric * r.costo_centavos end)
                    filter (where r.costo_centavos is not null), 0)::bigint,
           coalesce(sum(r.subtotal_centavos) filter (where r.costo_centavos is null), 0)::bigint
      from renglones r
      join public.productos p on p.id = r.producto_id
     group by p.id, p.nombre, p.tipo_venta
     order by 5 desc, 2
     limit least(greatest(coalesce(p_limite, 20), 1), 200);
end;
$$;

-- ---------- mermas del período, valuadas al costo vigente cuando ocurrieron ----------
create function public.mermas_del_periodo(p_desde date, p_hasta date)
returns table (
  producto_id    bigint,
  nombre         text,
  tipo_venta     public.tipo_venta,
  cantidad       bigint,   -- en positivo
  costo_centavos bigint,   -- valor de lo que se perdió, solo de lo que tiene costo
  sin_costo      bigint    -- cuántos registros no tenían costo cargado
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 366 then
    raise exception 'rango_invalido';
  end if;

  return query
    select p.id, p.nombre, p.tipo_venta,
           sum(-m.cantidad)::bigint,
           coalesce(sum(case when p.tipo_venta = 'peso'
                             then round((-m.cantidad)::numeric * c.costo_centavos / 1000)
                             else (-m.cantidad)::numeric * c.costo_centavos end)
                    filter (where c.costo_centavos is not null), 0)::bigint,
           count(*) filter (where c.costo_centavos is null)::bigint
      from public.movimientos_stock m
      join public.productos p on p.id = m.producto_id
      left join lateral (
        select cp.costo_centavos
          from public.costos_producto cp
         where cp.producto_id = m.producto_id and cp.vigente_desde <= m.creado_en
         order by cp.vigente_desde desc, cp.id desc
         limit 1
      ) c on true
     where m.tipo = 'merma'
       and (m.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
     group by p.id, p.nombre, p.tipo_venta
     order by 5 desc, 2;
end;
$$;

-- ---------- vencimientos próximos ----------
-- Supone que lo más viejo se vende primero (FIFO): de cada lote queda lo que sobra del stock
-- actual después de descontar lo ingresado DESPUÉS. Devuelve solo lotes con algo por vender.
-- dias_restantes negativo = ya venció.
create function public.vencimientos_proximos(p_dias integer)
returns table (
  lote_id         bigint,
  producto_id     bigint,
  nombre          text,
  tipo_venta      public.tipo_venta,
  quedan          bigint,
  vence_el        date,
  dias_restantes  integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  if p_dias is null or p_dias < 0 or p_dias > 365 then raise exception 'rango_invalido'; end if;

  return query
    select q.id, q.producto_id, q.nombre, q.tipo_venta, q.quedan, q.vence_el, (q.vence_el - v_hoy)::integer
      from (
        select l.id, l.producto_id, p.nombre, p.tipo_venta, l.vence_el,
               least(l.cantidad::bigint,
                     greatest(0::bigint,
                              s.stock - coalesce((select sum(m2.cantidad) from public.movimientos_stock m2
                                                   where m2.producto_id = l.producto_id and m2.tipo = 'ingreso'
                                                     and m2.id > l.movimiento_id), 0))) as quedan
          from public.lotes_stock l
          join public.productos p on p.id = l.producto_id and p.activo
          join public.stock_actual s on s.producto_id = l.producto_id
         where l.vence_el is not null and l.vence_el <= v_hoy + p_dias
      ) q
     where q.quedan > 0
     order by q.vence_el, q.nombre;
end;
$$;

revoke execute on function public.registrar_ingreso(bigint, integer, text, uuid, integer, date, bigint, boolean, date) from public, anon;
revoke execute on function public.registrar_merma(bigint, integer, text, uuid)          from public, anon;
revoke execute on function public.cambiar_precios(jsonb)                                 from public, anon;
revoke execute on function public.resumen_ganancia(date, date)                           from public, anon;
revoke execute on function public.margen_por_producto(date, date, integer)              from public, anon;
revoke execute on function public.mermas_del_periodo(date, date)                         from public, anon;
revoke execute on function public.vencimientos_proximos(integer)                         from public, anon;
grant  execute on function public.registrar_ingreso(bigint, integer, text, uuid, integer, date, bigint, boolean, date) to authenticated;
grant  execute on function public.registrar_merma(bigint, integer, text, uuid)          to authenticated;
grant  execute on function public.cambiar_precios(jsonb)                                 to authenticated;
grant  execute on function public.resumen_ganancia(date, date)                           to authenticated;
grant  execute on function public.margen_por_producto(date, date, integer)              to authenticated;
grant  execute on function public.mermas_del_periodo(date, date)                         to authenticated;
grant  execute on function public.vencimientos_proximos(integer)                         to authenticated;
