-- ============================================================
-- 3) SEGURIDAD: Row Level Security (RLS)
-- ============================================================
-- Con RLS activado y SIN políticas, nadie puede nada (ni leer).
-- Cada política abre una puerta concreta. Si un rol no figura, no entra.
--
-- Roles de la app:
--   dueno  -> todo
--   cajero -> vender, abrir/cerrar caja, ver catálogo y precios.
--             NO ve costos, ni edita precios/productos, ni anula ventas.
-- Un usuario sin perfil (o desactivado) no puede nada: es_personal() da false.

alter table public.perfiles          enable row level security;
alter table public.categorias        enable row level security;
alter table public.productos         enable row level security;
alter table public.precios_producto  enable row level security;
alter table public.costos_producto   enable row level security;
alter table public.turnos_caja       enable row level security;
alter table public.movimientos_caja  enable row level security;
alter table public.ventas            enable row level security;
alter table public.venta_items       enable row level security;
alter table public.pagos_venta       enable row level security;
alter table public.movimientos_stock enable row level security;

-- ---------- perfiles ----------
create policy perfiles_ver_propio_o_dueno on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.es_dueno());

create policy perfiles_dueno_todo on public.perfiles
  for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

-- ---------- catálogo: lo ve el personal, lo edita el dueño ----------
create policy categorias_ver on public.categorias
  for select to authenticated using (public.es_personal());
create policy categorias_dueno_escribe on public.categorias
  for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

create policy productos_ver on public.productos
  for select to authenticated using (public.es_personal());
create policy productos_dueno_escribe on public.productos
  for all to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

create policy precios_ver on public.precios_producto
  for select to authenticated using (public.es_personal());
create policy precios_dueno_inserta on public.precios_producto
  for insert to authenticated with check (public.es_dueno());
-- (sin política de update/delete: el historial de precios no se modifica)

-- ---------- costos: SOLO el dueño, ni siquiera lectura para el cajero ----------
create policy costos_dueno_ver on public.costos_producto
  for select to authenticated using (public.es_dueno());
create policy costos_dueno_inserta on public.costos_producto
  for insert to authenticated with check (public.es_dueno());

-- ---------- caja ----------
create policy turnos_ver on public.turnos_caja
  for select to authenticated using (public.es_personal());
create policy turnos_abrir on public.turnos_caja
  for insert to authenticated
  with check (public.es_personal() and abierto_por = auth.uid() and cerrado_en is null);
-- Cerrar = actualizar un turno que está abierto. El dueño puede corregir cualquiera.
create policy turnos_cerrar on public.turnos_caja
  for update to authenticated
  using (public.es_dueno() or (public.es_personal() and cerrado_en is null))
  with check (public.es_personal());

create policy mov_caja_ver on public.movimientos_caja
  for select to authenticated using (public.es_personal());
create policy mov_caja_insertar on public.movimientos_caja
  for insert to authenticated
  with check (public.es_personal() and usuario_id = auth.uid());

-- ---------- ventas ----------
-- El cajero ve solo sus ventas; el dueño ve todas.
create policy ventas_ver on public.ventas
  for select to authenticated
  using (public.es_dueno() or (public.es_personal() and usuario_id = auth.uid()));
create policy ventas_insertar on public.ventas
  for insert to authenticated
  with check (public.es_personal() and usuario_id = auth.uid() and estado = 'completada');
-- Anular una venta: solo el dueño.
create policy ventas_dueno_anula on public.ventas
  for update to authenticated
  using (public.es_dueno()) with check (public.es_dueno());

-- Ítems y pagos heredan la visibilidad de su venta (el subselect ya pasa por RLS de ventas).
create policy venta_items_ver on public.venta_items
  for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = venta_id));
create policy venta_items_insertar on public.venta_items
  for insert to authenticated
  with check (exists (select 1 from public.ventas v where v.id = venta_id and v.usuario_id = auth.uid()));

create policy pagos_ver on public.pagos_venta
  for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = venta_id));
create policy pagos_insertar on public.pagos_venta
  for insert to authenticated
  with check (exists (select 1 from public.ventas v where v.id = venta_id and v.usuario_id = auth.uid()));

-- ---------- stock ----------
create policy stock_ver on public.movimientos_stock
  for select to authenticated using (public.es_personal());
-- El dueño registra cualquier movimiento (ingresos, mermas, ajustes, anulaciones).
create policy stock_dueno_inserta on public.movimientos_stock
  for insert to authenticated
  with check (public.es_dueno() and usuario_id = auth.uid());
-- El cajero solo puede registrar salidas por venta.
create policy stock_cajero_venta on public.movimientos_stock
  for insert to authenticated
  with check (public.es_personal() and tipo = 'venta' and usuario_id = auth.uid());
-- (sin update/delete: el libro de stock solo se escribe hacia adelante)
