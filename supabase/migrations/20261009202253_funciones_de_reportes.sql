-- ============================================================
-- 8) Funciones de lectura para el panel del dueño
-- ============================================================
-- Sumar miles de ventas se hace EN LA BASE, no en el navegador.
-- Todas son SECURITY INVOKER: respetan RLS (el dueño ve todo; un cajero solo ve sus propias ventas).
-- El "día" es SIEMPRE el día calendario de Argentina (los servidores trabajan en UTC, 3 horas
-- adelantados: sin esto, una venta de las 23:59 caería en el día siguiente).
-- Solo cuentan ventas 'completada' (las anuladas no suman).

-- ---------- ventas por día ----------
-- Devuelve UNA fila por cada uno de los últimos p_dias días (hoy incluido), aun los días sin ventas.
create function public.ventas_por_dia(p_dias integer)
returns table (dia date, cantidad bigint, total bigint, descuentos bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if p_dias is null or p_dias < 1 or p_dias > 366 then raise exception 'rango_invalido'; end if;

  return query
    select d.dia,
           count(v.id),
           coalesce(sum(v.total_centavos), 0)::bigint,
           coalesce(sum(v.descuento_centavos), 0)::bigint
      from (select g::date as dia from generate_series(v_hoy - (p_dias - 1), v_hoy, interval '1 day') as g) d
      left join public.ventas v
        on v.estado = 'completada'
       and (v.creado_en at time zone 'America/Argentina/Buenos_Aires')::date = d.dia
     group by d.dia
     order by d.dia;
end;
$$;

-- ---------- cobrado por medio de pago ----------
create function public.ventas_por_medio(p_desde date, p_hasta date)
returns table (medio public.medio_pago, cantidad bigint, total bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 366 then
    raise exception 'rango_invalido';
  end if;

  return query
    select pv.medio, count(*), sum(pv.monto_centavos)::bigint
      from public.pagos_venta pv
      join public.ventas v on v.id = pv.venta_id
     where v.estado = 'completada'
       and (v.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
     group by pv.medio
     order by 3 desc;
end;
$$;

-- ---------- productos más vendidos ----------
-- "ingresos" = suma de los renglones a precio de lista (antes de descuentos sobre el total).
create function public.productos_mas_vendidos(p_desde date, p_hasta date, p_limite integer)
returns table (producto_id bigint, nombre text, tipo_venta public.tipo_venta, cantidad bigint, ingresos bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_desde is null or p_hasta is null or p_desde > p_hasta or p_hasta - p_desde > 366 then
    raise exception 'rango_invalido';
  end if;

  return query
    select p.id, p.nombre, p.tipo_venta, sum(vi.cantidad)::bigint, sum(vi.subtotal_centavos)::bigint
      from public.venta_items vi
      join public.ventas v    on v.id = vi.venta_id
      join public.productos p on p.id = vi.producto_id
     where v.estado = 'completada'
       and (v.creado_en at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta
     group by p.id, p.nombre, p.tipo_venta
     order by 5 desc, 2
     limit least(greatest(coalesce(p_limite, 10), 1), 100);
end;
$$;

revoke execute on function public.ventas_por_dia(integer)                       from public, anon;
revoke execute on function public.ventas_por_medio(date, date)                  from public, anon;
revoke execute on function public.productos_mas_vendidos(date, date, integer)   from public, anon;
grant  execute on function public.ventas_por_dia(integer)                       to authenticated;
grant  execute on function public.ventas_por_medio(date, date)                  to authenticated;
grant  execute on function public.productos_mas_vendidos(date, date, integer)   to authenticated;
