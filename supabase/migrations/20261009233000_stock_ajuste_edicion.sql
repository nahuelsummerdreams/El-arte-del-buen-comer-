-- ============================================================
-- 10) Stock confiable: recuento/ajuste, editar y archivar productos, historial y valor del inventario
-- ============================================================
-- Todo es SOLO del dueño. El stock sigue siendo la suma de movimientos: un ajuste es un movimiento más
-- (tipo 'ajuste') que deja el stock exactamente en lo que se contó, con motivo y responsable.

-- ---------- registrar_ajuste ----------
-- p_stock_contado: lo que HAY (gramos o unidades). La diferencia se calcula en el momento de guardar,
-- contra el stock real de ese instante: si mientras se contaba se vendió algo, el resultado final igual
-- queda en lo contado. Devuelve la diferencia aplicada (0 = coincidía, no se registra nada).
create function public.registrar_ajuste(
  p_producto_id    bigint,
  p_stock_contado  integer,
  p_motivo         text,
  p_clave          uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario  uuid := auth.uid();
  v_previo   integer;
  v_tipo     public.tipo_venta;
  v_actual   bigint;
  v_delta    bigint;
begin
  if v_usuario is null then raise exception 'sin_sesion' using errcode = '42501'; end if;
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  if p_clave is null then raise exception 'clave_obligatoria'; end if;

  select cantidad into v_previo from public.movimientos_stock where clave_idempotencia = p_clave;
  if found then return v_previo; end if;

  if p_stock_contado is null or p_stock_contado < 0 then raise exception 'cantidad_invalida'; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'motivo_obligatorio'; end if;

  -- Se bloquea la fila del producto: dos ajustes simultáneos del mismo producto se hacen de a uno.
  select tipo_venta into v_tipo from public.productos where id = p_producto_id and activo for update;
  if v_tipo is null then raise exception 'producto_no_encontrado'; end if;

  select stock into v_actual from public.stock_actual where producto_id = p_producto_id;
  v_delta := p_stock_contado - coalesce(v_actual, 0);
  if v_delta = 0 then return 0; end if;
  if abs(v_delta) > 2147483647 then raise exception 'cantidad_invalida'; end if;

  insert into public.movimientos_stock (producto_id, tipo, cantidad, motivo, usuario_id, clave_idempotencia)
  values (p_producto_id, 'ajuste', v_delta::integer, trim(p_motivo), v_usuario, p_clave);
  return v_delta::integer;
end;
$$;

-- ---------- actualizar_producto ----------
-- El TIPO de venta (peso/unidad) no se cambia nunca: todo el historial está en esa unidad (gramos o unidades).
-- Si hace falta, se archiva y se crea otro. El precio cambia agregando una fila al historial.
create function public.actualizar_producto(
  p_id              bigint,
  p_nombre          text,
  p_categoria_id    bigint,
  p_codigo          text,
  p_stock_minimo    integer,
  p_precio_centavos integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_precio_actual integer;
begin
  if v_usuario is null then raise exception 'sin_sesion' using errcode = '42501'; end if;
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  if p_stock_minimo is null or p_stock_minimo < 0 then raise exception 'minimo_invalido'; end if;
  if p_precio_centavos is null or p_precio_centavos <= 0 then raise exception 'precio_invalido'; end if;

  perform 1 from public.productos where id = p_id and activo for update;
  if not found then raise exception 'producto_no_encontrado'; end if;

  update public.productos
     set nombre = trim(p_nombre), categoria_id = p_categoria_id,
         codigo = nullif(trim(coalesce(p_codigo, '')), ''), stock_minimo = p_stock_minimo
   where id = p_id;

  select precio_centavos into v_precio_actual
    from public.precios_producto
   where producto_id = p_id and vigente_desde <= now()
   order by vigente_desde desc, id desc limit 1;

  if v_precio_actual is distinct from p_precio_centavos then
    insert into public.precios_producto (producto_id, precio_centavos, creado_por)
    values (p_id, p_precio_centavos, v_usuario);
  end if;
end;
$$;

-- ---------- archivar_producto ----------
-- Archivar = dejar de ofrecerlo (venta, ingresos, listas). Nada se borra: el historial queda completo.
create function public.archivar_producto(p_id bigint, p_activo boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'sin_sesion' using errcode = '42501'; end if;
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  if p_activo is null then raise exception 'cambio_invalido'; end if;
  update public.productos set activo = p_activo where id = p_id;
  if not found then raise exception 'producto_no_encontrado'; end if;
end;
$$;

-- ---------- valor del inventario ----------
-- Lo que hay parado en mercadería, al último costo cargado. Solo cuenta stock positivo.
-- Los productos con stock pero SIN costo se informan aparte: no se inventa un valor.
create function public.valor_inventario()
returns table (valor_centavos bigint, con_costo bigint, sin_costo bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  return query
    select coalesce(sum(case when c.costo_centavos is null then 0
                             when p.tipo_venta = 'peso' then round(s.stock::numeric * c.costo_centavos / 1000)
                             else s.stock::numeric * c.costo_centavos end), 0)::bigint,
           count(*) filter (where c.costo_centavos is not null)::bigint,
           count(*) filter (where c.costo_centavos is null)::bigint
      from public.productos p
      join public.stock_actual s on s.producto_id = p.id
      left join lateral (
        select cp.costo_centavos from public.costos_producto cp
         where cp.producto_id = p.id and cp.vigente_desde <= now()
         order by cp.vigente_desde desc, cp.id desc limit 1
      ) c on true
     where p.activo and s.stock > 0;
end;
$$;

-- ---------- historial de un producto (con saldo acumulado) ----------
create function public.historial_producto(p_producto_id bigint, p_limite integer)
returns table (
  id          bigint,
  tipo        public.tipo_mov_stock,
  cantidad    integer,
  saldo       bigint,
  motivo      text,
  usuario     text,
  creado_en   timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  return query
    select h.id, h.tipo, h.cantidad, h.saldo, h.motivo, h.usuario, h.creado_en
      from (
        select m.id, m.tipo, m.cantidad,
               sum(m.cantidad) over (order by m.creado_en, m.id)::bigint as saldo,
               m.motivo, coalesce(pf.nombre, 'sistema') as usuario, m.creado_en
          from public.movimientos_stock m
          left join public.perfiles pf on pf.id = m.usuario_id
         where m.producto_id = p_producto_id
      ) h
     order by h.creado_en desc, h.id desc
     limit least(greatest(coalesce(p_limite, 30), 1), 200);
end;
$$;

-- ---------- diferencias de recuento del período ----------
create function public.ajustes_del_periodo(p_desde date, p_hasta date)
returns table (faltante_centavos bigint, sobrante_centavos bigint, ajustes bigint, sin_costo bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 366 then raise exception 'rango_invalido'; end if;
  return query
    with a as (
      select m.cantidad, p.tipo_venta, c.costo_centavos
        from public.movimientos_stock m
        join public.productos p on p.id = m.producto_id
        left join lateral (
          select cp.costo_centavos from public.costos_producto cp
           where cp.producto_id = m.producto_id and cp.vigente_desde <= m.creado_en
           order by cp.vigente_desde desc, cp.id desc limit 1
        ) c on true
       where m.tipo = 'ajuste'
         and (m.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
    ), v as (
      select cantidad, costo_centavos,
             case when costo_centavos is null then 0
                  when tipo_venta = 'peso' then round(abs(cantidad)::numeric * costo_centavos / 1000)
                  else abs(cantidad)::numeric * costo_centavos end as valor
        from a
    )
    select coalesce(sum(valor) filter (where cantidad < 0), 0)::bigint,
           coalesce(sum(valor) filter (where cantidad > 0), 0)::bigint,
           count(*)::bigint,
           count(*) filter (where costo_centavos is null)::bigint
      from v;
end;
$$;

revoke execute on function public.registrar_ajuste(bigint, integer, text, uuid)                 from public, anon;
revoke execute on function public.actualizar_producto(bigint, text, bigint, text, integer, integer) from public, anon;
revoke execute on function public.archivar_producto(bigint, boolean)                            from public, anon;
revoke execute on function public.valor_inventario()                                            from public, anon;
revoke execute on function public.historial_producto(bigint, integer)                           from public, anon;
revoke execute on function public.ajustes_del_periodo(date, date)                               from public, anon;
grant  execute on function public.registrar_ajuste(bigint, integer, text, uuid)                 to authenticated;
grant  execute on function public.actualizar_producto(bigint, text, bigint, text, integer, integer) to authenticated;
grant  execute on function public.archivar_producto(bigint, boolean)                            to authenticated;
grant  execute on function public.valor_inventario()                                            to authenticated;
grant  execute on function public.historial_producto(bigint, integer)                           to authenticated;
grant  execute on function public.ajustes_del_periodo(date, date)                               to authenticated;
