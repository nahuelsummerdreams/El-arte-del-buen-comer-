-- ============================================================
-- 1) CATÁLOGO: usuarios, categorías, productos, precios y costos
-- ============================================================
-- Convenciones de todo el proyecto:
--   * Dinero: siempre en CENTAVOS, como entero (nunca decimales).
--   * Peso: siempre en GRAMOS, como entero.
--   * Nada se borra: se desactiva (activo = false) o se anula.

create type public.rol_usuario as enum ('dueno', 'cajero');
create type public.tipo_venta  as enum ('peso', 'unidad');

-- ---------- perfiles ----------
-- Extiende al usuario de login de Supabase (auth.users) con nombre y rol.
-- Un usuario SIN perfil no tiene acceso a nada (seguro por defecto).
create table public.perfiles (
  id        uuid primary key references auth.users (id) on delete cascade,
  nombre    text not null check (length(trim(nombre)) > 0),
  rol       public.rol_usuario not null default 'cajero',
  activo    boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ---------- funciones de ayuda para los permisos ----------
-- SECURITY DEFINER: se ejecutan con los derechos de su creador, así pueden
-- leer `perfiles` sin disparar las reglas de `perfiles` (evita recursión).
-- `set search_path = ''` es una buena práctica de seguridad en estas funciones.
create function public.es_personal()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and activo
  );
$$;

create function public.es_dueno()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and activo and rol = 'dueno'
  );
$$;

-- ---------- categorías ----------
create table public.categorias (
  id     bigint generated always as identity primary key,
  nombre text not null unique check (length(trim(nombre)) > 0),
  activo boolean not null default true
);

-- ---------- productos ----------
-- tipo_venta decide cómo se interpretan cantidades y precios:
--   'peso'   -> cantidad en gramos,   precio por KILO
--   'unidad' -> cantidad en unidades, precio por UNIDAD
create table public.productos (
  id           bigint generated always as identity primary key,
  categoria_id bigint not null references public.categorias (id),
  nombre       text not null check (length(trim(nombre)) > 0),
  codigo       text unique,                       -- código de barras / interno (opcional)
  tipo_venta   public.tipo_venta not null,
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  activo       boolean not null default true,
  creado_en    timestamptz not null default now()
);
create index productos_categoria_idx on public.productos (categoria_id);

-- ---------- historial de precios ----------
-- Cambiar un precio = INSERTAR una fila nueva. El vigente es el más reciente.
create table public.precios_producto (
  id              bigint generated always as identity primary key,
  producto_id     bigint not null references public.productos (id),
  precio_centavos integer not null check (precio_centavos >= 0),
  vigente_desde   timestamptz not null default now(),
  creado_por      uuid references public.perfiles (id)
);
create index precios_producto_vigente_idx
  on public.precios_producto (producto_id, vigente_desde desc);

-- ---------- historial de costos (SOLO dueño; ver migración de seguridad) ----------
create table public.costos_producto (
  id             bigint generated always as identity primary key,
  producto_id    bigint not null references public.productos (id),
  costo_centavos integer not null check (costo_centavos >= 0),
  vigente_desde  timestamptz not null default now(),
  creado_por     uuid references public.perfiles (id)
);
create index costos_producto_vigente_idx
  on public.costos_producto (producto_id, vigente_desde desc);

-- ---------- vista: producto con su precio vigente ----------
-- security_invoker = la vista respeta los permisos de quien la consulta.
create view public.productos_con_precio
with (security_invoker = true) as
select
  p.*,
  pr.precio_centavos
from public.productos p
left join lateral (
  select precio_centavos
  from public.precios_producto
  where producto_id = p.id and vigente_desde <= now()
  -- id desempata si dos precios tienen exactamente la misma fecha
  order by vigente_desde desc, id desc
  limit 1
) pr on true;
