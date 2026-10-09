-- ============================================================
-- 6) Clave de idempotencia en movimientos de stock
-- ============================================================
-- Cada formulario de ingreso lleva un código único (UUID). Si el mismo código llega dos veces
-- (doble clic, reintento por mala señal), la base rechaza el segundo y el stock no se duplica.
-- Es un índice único PARCIAL: los movimientos que no usan clave (NULL) no se ven afectados.
alter table public.movimientos_stock add column clave_idempotencia uuid;

create unique index movimientos_stock_clave_unica
  on public.movimientos_stock (clave_idempotencia)
  where clave_idempotencia is not null;
