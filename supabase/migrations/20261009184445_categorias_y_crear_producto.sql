-- ============================================================
-- 5) Categorías iniciales y creación atómica de productos
-- ============================================================

-- Categorías base (el dueño puede agregar más). "on conflict do nothing": si ya existen, no se duplican.
insert into public.categorias (nombre) values
  ('Fiambres'), ('Quesos'), ('Snacks'), ('Bebidas'), ('Panificados')
on conflict (nombre) do nothing;

-- Evita duplicados accidentales (por ejemplo, un doble clic en "Guardar"):
-- no puede haber dos productos ACTIVOS con el mismo nombre en la misma categoría
-- (sin distinguir mayúsculas).
create unique index productos_nombre_por_categoria_unico
  on public.productos (categoria_id, lower(nombre)) where activo;

-- Crea un producto Y su primer precio en UNA transacción: o se guardan los dos o ninguno.
-- SECURITY INVOKER (el valor por defecto, explícito a propósito): corre con los permisos de
-- quien la llama, así que las reglas RLS siguen aplicando. Un cajero que la invoque recibe
-- el mismo rechazo que si intentara insertar directamente en la tabla.
create function public.crear_producto(
  p_categoria_id    bigint,
  p_nombre          text,
  p_codigo          text,
  p_tipo_venta      public.tipo_venta,
  p_precio_centavos integer
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.productos (categoria_id, nombre, codigo, tipo_venta)
  values (p_categoria_id, trim(p_nombre), nullif(trim(p_codigo), ''), p_tipo_venta)
  returning id into v_id;

  insert into public.precios_producto (producto_id, precio_centavos, creado_por)
  values (v_id, p_precio_centavos, auth.uid());

  return v_id;
end;
$$;

-- Solo usuarios con sesión pueden ejecutarla (quitamos el permiso por defecto a PUBLIC y anon).
revoke execute on function public.crear_producto(bigint, text, text, public.tipo_venta, integer) from public, anon;
grant  execute on function public.crear_producto(bigint, text, text, public.tipo_venta, integer) to authenticated;
