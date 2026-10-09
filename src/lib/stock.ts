import { cantidadABase, ErrorDeCantidad } from "@/lib/inventario";
import { esNoNegativo, leerFilas } from "@/lib/panel";
import { validarProducto, type ErroresProducto, type ProductoValidado } from "@/lib/productos";
import { formatearCantidad, type TipoVenta } from "@/lib/precios";

/**
 * Stock confiable: estados, filtros, recuento (ajuste), edición de productos e historial.
 * Funciones puras: números y texto adentro, números y texto afuera.
 */

// ------------------------------------------------------------------ estado
export type EstadoStock = "negativo" | "sin_stock" | "bajo" | "ok";

/**
 * - negativo : se vendió más de lo que el sistema creía que había (hay que contar y corregir)
 * - sin_stock: en cero
 * - bajo     : llegó al mínimo que cargó el dueño (o menos)
 * - ok       : todo bien
 */
export function estadoDeStock(stock: number, stockMinimo: number): EstadoStock {
  if (stock < 0) return "negativo";
  if (stock === 0) return "sin_stock";
  if (stockMinimo > 0 && stock <= stockMinimo) return "bajo";
  return "ok";
}

export const ETIQUETA_ESTADO: Record<EstadoStock, string> = {
  negativo: "Stock negativo",
  sin_stock: "Sin stock",
  bajo: "Stock bajo",
  ok: "En orden",
};

/** Orden de urgencia: lo más grave primero. */
const URGENCIA: Record<EstadoStock, number> = { negativo: 0, sin_stock: 1, bajo: 2, ok: 3 };

export type ItemStock = {
  id: number;
  nombre: string;
  categoriaId: number;
  tipoVenta: TipoVenta;
  stock: number;
  stockMinimo: number;
};

/** Sin mayúsculas ni tildes ("Jamón" y "jamon" se encuentran). */
export const sinTildes = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es-AR");

export type FiltroStock = { texto: string; categoriaId: number | null; estado: EstadoStock | "atencion" | null };

/** "atencion" = todo lo que no está en orden. */
export function filtrarStock(items: readonly ItemStock[], f: FiltroStock): ItemStock[] {
  const buscado = sinTildes(f.texto.trim());
  return items.filter((i) => {
    if (f.categoriaId !== null && i.categoriaId !== f.categoriaId) return false;
    const e = estadoDeStock(i.stock, i.stockMinimo);
    if (f.estado === "atencion" ? e === "ok" : f.estado !== null && e !== f.estado) return false;
    return buscado === "" || sinTildes(i.nombre).includes(buscado);
  });
}

export function ordenarPorUrgencia(items: readonly ItemStock[]): ItemStock[] {
  return [...items].sort(
    (a, b) =>
      URGENCIA[estadoDeStock(a.stock, a.stockMinimo)] - URGENCIA[estadoDeStock(b.stock, b.stockMinimo)] ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
}

export function contarPorEstado(items: readonly ItemStock[]): Record<EstadoStock, number> {
  const c: Record<EstadoStock, number> = { negativo: 0, sin_stock: 0, bajo: 0, ok: 0 };
  for (const i of items) c[estadoDeStock(i.stock, i.stockMinimo)] += 1;
  return c;
}

// ---------------------------------------------------------------- cantidades
/**
 * Como cantidadABase, pero acepta CERO (se puede contar "no queda nada" o no poner mínimo).
 * "0", "0,0", "0,000" valen cero; el resto sigue las reglas de siempre (coma, sin punto, topes).
 */
export function cantidadConCeroABase(texto: string, tipoVenta: TipoVenta): number {
  const t = texto.trim();
  if (tipoVenta === "unidad" ? /^0+$/.test(t) : /^0+(,0{1,3})?$/.test(t)) return 0;
  return cantidadABase(t, tipoVenta);
}

function errorDeCantidad(e: unknown, tipoVenta: TipoVenta, tope: string): string {
  const motivo = e instanceof ErrorDeCantidad ? e.motivo : "invalida";
  if (motivo === "punto") return "Usá coma para los decimales. Ejemplo: 2,5";
  if (motivo === "excede") return tipoVenta === "peso" ? `Máximo 1.000 kg ${tope}.` : `Máximo 100.000 unidades ${tope}.`;
  return tipoVenta === "peso" ? "Cantidad inválida. Escribila en kilos, con coma. Ejemplo: 2,5" : "Cantidad inválida. Escribí un número entero de unidades. Ejemplo: 12";
}

// ------------------------------------------------------------------ recuento
export type DiferenciaRecuento = { delta: number; tipo: "coincide" | "faltan" | "sobran"; texto: string };

/** Qué diferencia hay entre lo que dice el sistema y lo que se contó, en palabras. */
export function diferenciaDeRecuento(actual: number, contado: number, tipoVenta: TipoVenta): DiferenciaRecuento {
  const delta = contado - actual;
  if (delta === 0) return { delta, tipo: "coincide", texto: "Coincide: el sistema ya tenía esa cantidad." };
  const cantidad = formatearCantidad(Math.abs(delta), tipoVenta);
  return delta < 0
    ? { delta, tipo: "faltan", texto: `Faltan ${cantidad} respecto del sistema.` }
    : { delta, tipo: "sobran", texto: `Sobran ${cantidad} respecto del sistema.` };
}

export const MOTIVOS_AJUSTE = ["Recuento físico", "Error de carga anterior", "Mercadería sin registrar", "Se terminó", "Otro motivo"] as const;

export type RecuentoValidado = { productoId: number; contado: number; motivo: string; clave: string };
export type CampoRecuento = "productoId" | "contado" | "motivo" | "detalle" | "clave";
export type ErroresRecuento = Partial<Record<CampoRecuento, string>>;
export type ResultadoRecuento = { ok: true; valores: RecuentoValidado } | { ok: false; errores: ErroresRecuento };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: unknown) => (typeof v === "string" ? v : "");
const DETALLE_MAX = 120;

export function validarRecuento(entrada: Record<string, unknown>, tipoVenta: TipoVenta | null): ResultadoRecuento {
  const errores: ErroresRecuento = {};

  const idCrudo = texto(entrada.productoId).trim();
  const productoId = /^\d+$/.test(idCrudo) ? Number(idCrudo) : NaN;
  if (!Number.isSafeInteger(productoId) || productoId < 1 || tipoVenta === null) errores.productoId = "Producto inválido.";

  let contado = 0;
  const crudo = texto(entrada.contado);
  if (crudo.trim() === "") errores.contado = "Escribí cuánto hay (si no queda nada, poné 0).";
  else if (tipoVenta !== null) {
    try {
      contado = cantidadConCeroABase(crudo, tipoVenta);
    } catch (e) {
      errores.contado = errorDeCantidad(e, tipoVenta, "por recuento");
    }
  }

  const motivo = texto(entrada.motivo).trim();
  const detalle = texto(entrada.detalle).trim();
  if (!(MOTIVOS_AJUSTE as readonly string[]).includes(motivo)) errores.motivo = "Elegí el motivo.";
  if (detalle.length > DETALLE_MAX) errores.detalle = `El detalle admite hasta ${DETALLE_MAX} caracteres.`;
  if (motivo === "Otro motivo" && detalle === "") errores.detalle = "Contanos qué pasó.";

  const clave = texto(entrada.clave).trim();
  if (!UUID.test(clave)) errores.clave = "El formulario no es válido. Recargá la página e intentá de nuevo.";

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, valores: { productoId, contado, motivo: detalle === "" ? motivo : `${motivo}: ${detalle}`, clave: clave.toLowerCase() } };
}

export function mensajeDeErrorDeStock(error: { code?: string; message?: string }, accion: string): string {
  const m = error.message ?? "";
  if (error.code === "42501" || m === "solo_dueno") return `No tenés permiso para ${accion}.`;
  if (m === "producto_no_encontrado") return "El producto no existe o ya está archivado.";
  if (error.code === "23505") {
    if (m.includes("productos_nombre_por_categoria_unico")) return "Ya existe un producto con ese nombre en esa categoría.";
    if (m.includes("codigo")) return "Ya existe un producto con ese código.";
    return "Ya existe un producto igual.";
  }
  if (error.code === "23503") return "La categoría elegida no existe.";
  if (m === "minimo_invalido") return "El stock mínimo no es válido.";
  if (m === "precio_invalido") return "El precio debe ser mayor a cero.";
  if (m.includes("fetch failed")) return "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.";
  return `No se pudo ${accion}. Intentá de nuevo.`;
}

// ------------------------------------------------------------ editar producto
export type EdicionValidada = ProductoValidado & { stockMinimo: number };
export type ErroresEdicion = ErroresProducto & { stockMinimo?: string };
export type ResultadoEdicion = { ok: true; valores: EdicionValidada } | { ok: false; errores: ErroresEdicion };

/**
 * Valida el formulario de edición. El tipo de venta (peso/unidad) viene de la base y NO se edita:
 * todo el historial de ese producto está en gramos o en unidades.
 */
export function validarEdicionProducto(entrada: Record<string, unknown>, tipoVenta: TipoVenta | null): ResultadoEdicion {
  if (tipoVenta === null) return { ok: false, errores: { nombre: "El producto no existe o está archivado." } };
  const base = validarProducto({ ...entrada, tipoVenta });
  const errores: ErroresEdicion = base.ok ? {} : { ...base.errores };

  let stockMinimo = 0;
  const crudo = texto(entrada.stockMinimo).trim();
  if (crudo !== "") {
    try {
      stockMinimo = cantidadConCeroABase(crudo, tipoVenta);
    } catch (e) {
      errores.stockMinimo = errorDeCantidad(e, tipoVenta, "de mínimo");
    }
  }

  if (!base.ok || Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, valores: { ...base.valores, stockMinimo } };
}

// ------------------------------------------------------- lecturas de la base
export type FilaValorInventario = { valor_centavos: number; con_costo: number; sin_costo: number };
export const leerValorInventario = (datos: unknown): FilaValorInventario | null => {
  const filas = leerFilas<FilaValorInventario>(datos, (f) =>
    esNoNegativo(f.valor_centavos) && esNoNegativo(f.con_costo) && esNoNegativo(f.sin_costo)
      ? { valor_centavos: f.valor_centavos, con_costo: f.con_costo, sin_costo: f.sin_costo }
      : null,
  );
  return filas && filas.length === 1 ? filas[0] : null;
};

export type TipoMovimiento = "ingreso" | "venta" | "anulacion_venta" | "merma" | "ajuste";
export type FilaHistorial = { id: number; tipo: TipoMovimiento; cantidad: number; saldo: number; motivo: string | null; usuario: string; creado_en: string };
const TIPOS: readonly string[] = ["ingreso", "venta", "anulacion_venta", "merma", "ajuste"];

export const leerHistorial = (datos: unknown) =>
  leerFilas<FilaHistorial>(datos, (f) =>
    esNoNegativo(f.id) && typeof f.tipo === "string" && TIPOS.includes(f.tipo) &&
    typeof f.cantidad === "number" && Number.isSafeInteger(f.cantidad) &&
    typeof f.saldo === "number" && Number.isSafeInteger(f.saldo) &&
    (f.motivo === null || typeof f.motivo === "string") && typeof f.usuario === "string" && typeof f.creado_en === "string"
      ? { id: f.id, tipo: f.tipo as TipoMovimiento, cantidad: f.cantidad, saldo: f.saldo, motivo: f.motivo as string | null, usuario: f.usuario, creado_en: f.creado_en }
      : null,
  );

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  ingreso: "Ingreso de mercadería",
  venta: "Venta",
  anulacion_venta: "Venta anulada",
  merma: "Pérdida",
  ajuste: "Ajuste por recuento",
};

export type FilaAjustes = { faltante_centavos: number; sobrante_centavos: number; ajustes: number; sin_costo: number };
export const leerAjustesDelPeriodo = (datos: unknown): FilaAjustes | null => {
  const filas = leerFilas<FilaAjustes>(datos, (f) =>
    esNoNegativo(f.faltante_centavos) && esNoNegativo(f.sobrante_centavos) && esNoNegativo(f.ajustes) && esNoNegativo(f.sin_costo)
      ? { faltante_centavos: f.faltante_centavos, sobrante_centavos: f.sobrante_centavos, ajustes: f.ajustes, sin_costo: f.sin_costo }
      : null,
  );
  return filas && filas.length === 1 ? filas[0] : null;
};
