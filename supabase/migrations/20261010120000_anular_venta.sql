-- Anular una venta (solo el dueño): la venta queda marcada como anulada con motivo y responsable,
-- el stock vuelve al libro con un movimiento 'anulacion_venta' por cada renglón, y la venta deja de
-- contar en reportes y en la caja (todos filtran estado = 'completada').
-- No se borra nada: el comprobante sigue existiendo, ahora como ANULADO.
--
-- Regla de seguridad: solo se anula mientras la caja de esa venta siga ABIERTA. Si el turno ya se cerró,
-- el efectivo se contó contra esa venta; cambiarla después descuadraría un cierre ya hecho.

create function public.anular_venta(p_venta_id bigint, p_motivo text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario  uuid := auth.uid();
  v_venta    public.ventas;
  v_cerrado  timestamptz;
  v_filas    integer;
begin
  if v_usuario is null then raise exception 'sin_sesion' using errcode = '42501'; end if;
  if not public.es_dueno() then raise exception 'solo_dueno' using errcode = '42501'; end if;
  if length(trim(coalesce(p_motivo, ''))) = 0 then raise exception 'motivo_obligatorio'; end if;
  if length(trim(p_motivo)) > 200 then raise exception 'motivo_largo'; end if;

  -- Se bloquea la venta: dos anulaciones simultáneas de la misma venta se hacen de a una.
  select * into v_venta from public.ventas where id = p_venta_id for update;
  if not found then raise exception 'venta_inexistente'; end if;
  if v_venta.estado = 'anulada' then raise exception 'ya_anulada'; end if;

  select cerrado_en into v_cerrado from public.turnos_caja where id = v_venta.turno_id;
  if v_cerrado is not null then raise exception 'turno_cerrado'; end if;

  update public.ventas
     set estado = 'anulada', anulada_en = now(), anulada_por = v_usuario, motivo_anulacion = trim(p_motivo)
   where id = p_venta_id;

  insert into public.movimientos_stock (producto_id, tipo, cantidad, venta_item_id, motivo, usuario_id)
  select i.producto_id, 'anulacion_venta', i.cantidad, i.id,
         'Anulación de la venta N.º ' || p_venta_id || ': ' || trim(p_motivo), v_usuario
    from public.venta_items i where i.venta_id = p_venta_id;
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

revoke execute on function public.anular_venta(bigint, text) from public, anon;
grant  execute on function public.anular_venta(bigint, text) to authenticated;
