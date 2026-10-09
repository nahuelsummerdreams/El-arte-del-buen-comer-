-- ============================================================
-- 7) Venta atómica y caja
-- ============================================================
-- Registrar una venta toca varias tablas (venta, renglones, pagos, stock). Se hace dentro de UNA
-- función: o se guarda todo o no se guarda nada. Y el PRECIO lo busca la base: nunca se confía
-- en el que mande el navegador.

-- ---------- columnas nuevas en ventas ----------
alter table public.ventas
  add column subtotal_centavos  integer not null default 0 check (subtotal_centavos >= 0),
  add column descuento_centavos integer not null default 0 check (descuento_centavos >= 0),
  add column descuento_por      uuid references public.perfiles (id),
  add column clave_idempotencia uuid;

-- El total siempre es subtotal - descuento, y un descuento siempre tiene responsable.
alter table public.ventas add constraint ventas_total_coherente check (
  descuento_centavos <= subtotal_centavos
  and total_centavos = subtotal_centavos - descuento_centavos
  and ((descuento_centavos = 0) = (descuento_por is null))
);

-- Un doble clic o un reintento por mala señal no puede cobrar dos veces.
create unique index ventas_clave_unica
  on public.ventas (clave_idempotencia) where clave_idempotencia is not null;

-- ---------- registrar_venta ----------
-- p_items : [{"producto_id": 7, "cantidad": 250}, ...]   (gramos si es por peso, unidades si no)
-- p_pagos : [{"medio": "efectivo", "monto": 500000}, ...] (centavos; deben sumar EXACTAMENTE el total)
-- Devuelve el id de la venta. Si la clave ya existe, devuelve la venta ya registrada (idempotente).
-- SECURITY INVOKER: corre con los permisos de quien llama, así que RLS sigue valiendo.
create function public.registrar_venta(
  p_items               jsonb,
  p_pagos               jsonb,
  p_descuento_centavos  integer,
  p_clave               uuid
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usuario    uuid := auth.uid();
  v_existente  bigint;
  v_turno      bigint;
  v_linea      jsonb;
  v_producto   record;
  v_cantidad   bigint;
  v_sub_linea  bigint;
  v_subtotal   bigint := 0;
  v_descuento  bigint := coalesce(p_descuento_centavos, 0);
  v_total      bigint;
  v_lineas     jsonb := '[]'::jsonb;
  v_venta      bigint;
  v_item       bigint;
  v_pago       jsonb;
  v_pagado     bigint := 0;
  v_monto      bigint;
begin
  if v_usuario is null then raise exception 'sin_sesion' using errcode = '42501'; end if;
  if p_clave is null then raise exception 'clave_invalida'; end if;

  -- Reintento: si esta clave ya generó una venta, la devolvemos (no se cobra de nuevo).
  select id into v_existente from public.ventas where clave_idempotencia = p_clave;
  if found then return v_existente; end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'carrito_vacio';
  end if;
  if jsonb_array_length(p_items) > 100 then raise exception 'carrito_demasiado_grande'; end if;

  select id into v_turno from public.turnos_caja where cerrado_en is null;
  if v_turno is null then raise exception 'caja_cerrada'; end if;

  -- 1) Calcular cada renglón con el precio VIGENTE de la base.
  for v_linea in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_linea) is distinct from 'object'
       or (v_linea->>'producto_id') is null or (v_linea->>'producto_id') !~ '^[0-9]{1,15}$'
       or (v_linea->>'cantidad')    is null or (v_linea->>'cantidad')    !~ '^[0-9]{1,9}$' then
      raise exception 'item_invalido';
    end if;
    v_cantidad := (v_linea->>'cantidad')::bigint;
    if v_cantidad < 1 then raise exception 'item_invalido'; end if;

    select p.id, p.tipo_venta, pr.precio_centavos
      into v_producto
      from public.productos p
      left join lateral (
        select precio_centavos from public.precios_producto
        where producto_id = p.id and vigente_desde <= now()
        order by vigente_desde desc, id desc limit 1
      ) pr on true
     where p.id = (v_linea->>'producto_id')::bigint and p.activo;
    if not found then raise exception 'producto_invalido'; end if;
    if v_producto.precio_centavos is null then raise exception 'producto_sin_precio'; end if;

    if v_producto.tipo_venta = 'peso' then
      if v_cantidad > 1000000 then raise exception 'item_invalido'; end if;
      -- gramos x precio por kilo / 1000, redondeado al centavo (el medio sube): igual que en el código.
      v_sub_linea := (v_cantidad * v_producto.precio_centavos + 500) / 1000;
    else
      if v_cantidad > 100000 then raise exception 'item_invalido'; end if;
      v_sub_linea := v_cantidad * v_producto.precio_centavos;
    end if;
    if v_sub_linea > 2147483647 then raise exception 'importe_demasiado_grande'; end if;

    v_subtotal := v_subtotal + v_sub_linea;
    v_lineas := v_lineas || jsonb_build_object(
      'producto_id', v_producto.id, 'cantidad', v_cantidad,
      'precio', v_producto.precio_centavos, 'subtotal', v_sub_linea);
  end loop;
  if v_subtotal > 2147483647 then raise exception 'importe_demasiado_grande'; end if;

  -- 2) Descuento: solo el dueño, y nunca más que el subtotal.
  if v_descuento < 0 then raise exception 'descuento_invalido'; end if;
  if v_descuento > 0 and not public.es_dueno() then
    raise exception 'descuento_no_autorizado' using errcode = '42501';
  end if;
  if v_descuento > v_subtotal then raise exception 'descuento_invalido'; end if;
  v_total := v_subtotal - v_descuento;
  if v_total <= 0 then raise exception 'total_invalido'; end if;

  -- 3) Los pagos tienen que sumar EXACTAMENTE el total.
  if jsonb_typeof(p_pagos) is distinct from 'array' or jsonb_array_length(p_pagos) = 0 then
    raise exception 'pagos_no_coinciden';
  end if;
  for v_pago in select * from jsonb_array_elements(p_pagos) loop
    if jsonb_typeof(v_pago) is distinct from 'object'
       or (v_pago->>'medio') is null or (v_pago->>'medio') not in ('efectivo', 'tarjeta', 'transferencia', 'billetera')
       or (v_pago->>'monto') is null or (v_pago->>'monto') !~ '^[0-9]{1,10}$' then
      raise exception 'pagos_no_coinciden';
    end if;
    v_monto := (v_pago->>'monto')::bigint;
    if v_monto < 1 then raise exception 'pagos_no_coinciden'; end if;
    v_pagado := v_pagado + v_monto;
  end loop;
  if v_pagado <> v_total then raise exception 'pagos_no_coinciden'; end if;

  -- 4) Guardar todo. Si dos envíos con la misma clave llegan a la vez, el segundo choca con el
  --    índice único: lo atajamos y devolvemos la venta del primero.
  begin
    insert into public.ventas (turno_id, usuario_id, total_centavos, subtotal_centavos,
                               descuento_centavos, descuento_por, clave_idempotencia)
    values (v_turno, v_usuario, v_total, v_subtotal, v_descuento,
            case when v_descuento > 0 then v_usuario end, p_clave)
    returning id into v_venta;

    for v_linea in select * from jsonb_array_elements(v_lineas) loop
      insert into public.venta_items (venta_id, producto_id, cantidad, precio_unitario_centavos, subtotal_centavos)
      values (v_venta, (v_linea->>'producto_id')::bigint, (v_linea->>'cantidad')::integer,
              (v_linea->>'precio')::integer, (v_linea->>'subtotal')::integer)
      returning id into v_item;

      insert into public.movimientos_stock (producto_id, tipo, cantidad, venta_item_id, usuario_id)
      values ((v_linea->>'producto_id')::bigint, 'venta', -(v_linea->>'cantidad')::integer, v_item, v_usuario);
    end loop;

    insert into public.pagos_venta (venta_id, medio, monto_centavos)
    select v_venta, (p->>'medio')::public.medio_pago, (p->>'monto')::integer
      from jsonb_array_elements(p_pagos) as p;
  exception when unique_violation then
    select id into v_existente from public.ventas where clave_idempotencia = p_clave;
    if found then return v_existente; end if;
    raise;
  end;

  return v_venta;
end;
$$;

revoke execute on function public.registrar_venta(jsonb, jsonb, integer, uuid) from public, anon;
grant  execute on function public.registrar_venta(jsonb, jsonb, integer, uuid) to authenticated;

-- ---------- movimientos de caja (retiros, gastos, ingresos de efectivo) ----------
create function public.registrar_movimiento_caja(
  p_tipo           public.tipo_mov_caja,
  p_monto_centavos integer,
  p_motivo         text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_turno bigint;
  v_id    bigint;
begin
  select id into v_turno from public.turnos_caja where cerrado_en is null;
  if v_turno is null then raise exception 'caja_cerrada'; end if;

  insert into public.movimientos_caja (turno_id, tipo, monto_centavos, motivo, usuario_id)
  values (v_turno, p_tipo, p_monto_centavos, trim(p_motivo), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.registrar_movimiento_caja(public.tipo_mov_caja, integer, text) from public, anon;
grant  execute on function public.registrar_movimiento_caja(public.tipo_mov_caja, integer, text) to authenticated;

-- ---------- resumen de un turno ----------
-- SECURITY DEFINER a propósito: un cajero solo ve SUS ventas, pero para cuadrar la caja hacen falta
-- las de TODO el turno (por ejemplo, las que cobró el dueño). Devuelve únicamente totales,
-- nunca renglones, y solo a personal activo.
create function public.resumen_turno(p_turno_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_turno   public.turnos_caja;
  v_por     jsonb;
  v_ventas  record;
  v_ing     bigint;
  v_ret     bigint;
  v_gas     bigint;
  v_esperado bigint;
begin
  if not public.es_personal() then raise exception 'sin_permiso' using errcode = '42501'; end if;
  select * into v_turno from public.turnos_caja where id = p_turno_id;
  if not found then raise exception 'turno_inexistente'; end if;

  select count(*) as cantidad, coalesce(sum(total_centavos), 0) as total, coalesce(sum(descuento_centavos), 0) as descuentos
    into v_ventas
    from public.ventas where turno_id = p_turno_id and estado = 'completada';

  select coalesce(jsonb_object_agg(m.medio, m.monto), '{}'::jsonb) into v_por
    from (select pv.medio, sum(pv.monto_centavos) as monto
            from public.pagos_venta pv join public.ventas v on v.id = pv.venta_id
           where v.turno_id = p_turno_id and v.estado = 'completada'
           group by pv.medio) m;

  select coalesce(sum(monto_centavos) filter (where tipo = 'ingreso'), 0),
         coalesce(sum(monto_centavos) filter (where tipo = 'retiro'), 0),
         coalesce(sum(monto_centavos) filter (where tipo = 'gasto'), 0)
    into v_ing, v_ret, v_gas
    from public.movimientos_caja where turno_id = p_turno_id;

  -- Efectivo que debería haber en el cajón.
  v_esperado := v_turno.efectivo_inicial_centavos + coalesce((v_por->>'efectivo')::bigint, 0) + v_ing - v_ret - v_gas;

  return jsonb_build_object(
    'turno_id', p_turno_id,
    'efectivo_inicial', v_turno.efectivo_inicial_centavos,
    'ventas_cantidad', v_ventas.cantidad,
    'ventas_total', v_ventas.total,
    'descuentos', v_ventas.descuentos,
    'por_medio', v_por,
    'ingresos_caja', v_ing,
    'retiros_caja', v_ret,
    'gastos_caja', v_gas,
    'efectivo_esperado', v_esperado,
    'efectivo_contado', v_turno.efectivo_contado_centavos,
    'diferencia', case when v_turno.efectivo_contado_centavos is null then null
                       else v_turno.efectivo_contado_centavos - v_esperado end
  );
end;
$$;

revoke execute on function public.resumen_turno(bigint) from public, anon;
grant  execute on function public.resumen_turno(bigint) to authenticated;

-- ---------- cerrar caja ----------
-- Cierra el turno abierto con el efectivo CONTADO y devuelve el resumen (con la diferencia).
create function public.cerrar_caja(p_turno_id bigint, p_efectivo_contado_centavos integer, p_nota text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_filas integer;
begin
  update public.turnos_caja
     set cerrado_en = now(), cerrado_por = auth.uid(),
         efectivo_contado_centavos = p_efectivo_contado_centavos,
         nota = nullif(trim(coalesce(p_nota, '')), '')
   where id = p_turno_id and cerrado_en is null;
  get diagnostics v_filas = row_count;
  if v_filas = 0 then raise exception 'caja_ya_cerrada'; end if;

  return public.resumen_turno(p_turno_id);
end;
$$;

revoke execute on function public.cerrar_caja(bigint, integer, text) from public, anon;
grant  execute on function public.cerrar_caja(bigint, integer, text) to authenticated;
