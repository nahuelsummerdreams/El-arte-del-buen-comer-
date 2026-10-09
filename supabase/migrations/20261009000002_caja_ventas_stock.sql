-- ============================================================
-- 2) CAJA, VENTAS Y STOCK
-- ============================================================

create type public.medio_pago        as enum ('efectivo', 'tarjeta', 'transferencia', 'billetera');
create type public.estado_venta      as enum ('completada', 'anulada');
create type public.tipo_mov_stock    as enum ('ingreso', 'venta', 'anulacion_venta', 'merma', 'ajuste');
create type public.tipo_mov_caja     as enum ('ingreso', 'retiro', 'gasto');

-- ---------- turnos de caja ----------
-- Un turno = desde que se abre la caja hasta que se cierra y se cuenta el efectivo.
create table public.turnos_caja (
  id                        bigint generated always as identity primary key,
  abierto_por               uuid not null references public.perfiles (id),
  abierto_en                timestamptz not null default now(),
  efectivo_inicial_centavos integer not null check (efectivo_inicial_centavos >= 0),
  cerrado_por               uuid references public.perfiles (id),
  cerrado_en                timestamptz,
  efectivo_contado_centavos integer check (efectivo_contado_centavos >= 0),
  nota                      text,
  -- Si está cerrado, tienen que estar completos los datos del cierre (y viceversa).
  constraint cierre_completo check (
    (cerrado_en is null and cerrado_por is null and efectivo_contado_centavos is null)
    or
    (cerrado_en is not null and cerrado_por is not null and efectivo_contado_centavos is not null)
  )
);
-- Hay un solo punto de venta: como máximo UN turno abierto a la vez.
-- (índice único parcial: solo cuenta las filas con cerrado_en nulo)
create unique index un_solo_turno_abierto
  on public.turnos_caja ((true)) where cerrado_en is null;

-- ---------- movimientos de caja (solo efectivo físico) ----------
create table public.movimientos_caja (
  id             bigint generated always as identity primary key,
  turno_id       bigint not null references public.turnos_caja (id),
  tipo           public.tipo_mov_caja not null,
  monto_centavos integer not null check (monto_centavos > 0),
  motivo         text not null check (length(trim(motivo)) > 0),
  usuario_id     uuid not null references public.perfiles (id),
  creado_en      timestamptz not null default now()
);
create index movimientos_caja_turno_idx on public.movimientos_caja (turno_id);

-- ---------- ventas ----------
create table public.ventas (
  id                bigint generated always as identity primary key,
  turno_id          bigint not null references public.turnos_caja (id),
  usuario_id        uuid not null references public.perfiles (id),
  estado            public.estado_venta not null default 'completada',
  total_centavos    integer not null check (total_centavos >= 0),
  creado_en         timestamptz not null default now(),
  anulada_en        timestamptz,
  anulada_por       uuid references public.perfiles (id),
  motivo_anulacion  text,
  constraint anulacion_completa check (
    (estado = 'completada' and anulada_en is null and anulada_por is null and motivo_anulacion is null)
    or
    (estado = 'anulada' and anulada_en is not null and anulada_por is not null and motivo_anulacion is not null)
  )
);
create index ventas_turno_idx on public.ventas (turno_id);
create index ventas_creado_idx on public.ventas (creado_en);

-- ---------- líneas de cada venta ----------
-- precio_unitario_centavos es una COPIA del precio al momento de vender:
-- si mañana cambia el precio, las ventas pasadas no se reescriben.
-- cantidad: gramos si el producto es 'peso', unidades si es 'unidad'.
create table public.venta_items (
  id                       bigint generated always as identity primary key,
  venta_id                 bigint not null references public.ventas (id),
  producto_id              bigint not null references public.productos (id),
  cantidad                 integer not null check (cantidad > 0),
  precio_unitario_centavos integer not null check (precio_unitario_centavos >= 0),
  subtotal_centavos        integer not null check (subtotal_centavos >= 0)
);
create index venta_items_venta_idx on public.venta_items (venta_id);
create index venta_items_producto_idx on public.venta_items (producto_id);

-- ---------- pagos de una venta ----------
-- Una venta puede pagarse con varios medios (ej.: parte efectivo, parte tarjeta).
-- Que la suma de pagos coincida con el total se valida al registrar la venta
-- (función de la Tarea de Ventas), no acá.
create table public.pagos_venta (
  id             bigint generated always as identity primary key,
  venta_id       bigint not null references public.ventas (id),
  medio          public.medio_pago not null,
  monto_centavos integer not null check (monto_centavos > 0)
);
create index pagos_venta_venta_idx on public.pagos_venta (venta_id);

-- ---------- libro de movimientos de stock ----------
-- El stock NO se edita: se calcula sumando movimientos.
-- cantidad con signo: positiva suma, negativa resta (gramos o unidades).
create table public.movimientos_stock (
  id            bigint generated always as identity primary key,
  producto_id   bigint not null references public.productos (id),
  tipo          public.tipo_mov_stock not null,
  cantidad      integer not null check (cantidad <> 0),
  venta_item_id bigint references public.venta_items (id),
  motivo        text,
  usuario_id    uuid not null references public.perfiles (id),
  creado_en     timestamptz not null default now(),
  -- El signo tiene que ser coherente con el tipo de movimiento.
  constraint signo_coherente check (
    (tipo in ('ingreso', 'anulacion_venta') and cantidad > 0)
    or (tipo in ('venta', 'merma') and cantidad < 0)
    or tipo = 'ajuste'
  ),
  -- Merma y ajuste exigen explicar por qué.
  constraint motivo_obligatorio check (
    tipo not in ('merma', 'ajuste') or length(trim(coalesce(motivo, ''))) > 0
  )
);
create index movimientos_stock_producto_idx on public.movimientos_stock (producto_id);

-- ---------- vista: stock actual por producto ----------
create view public.stock_actual
with (security_invoker = true) as
select
  p.id as producto_id,
  coalesce(sum(m.cantidad), 0)::integer as stock
from public.productos p
left join public.movimientos_stock m on m.producto_id = p.id
group by p.id;
