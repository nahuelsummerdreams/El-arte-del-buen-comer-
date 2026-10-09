/**
 * ARCHIVO GENERADO desde el esquema real de Supabase (proyecto arte-del-buen-comer).
 * NO lo edites a mano: cada vez que cambies la base con una migración, volvé a generarlo
 * (le pedís a Claude "regenerá los tipos de Supabase") y reemplazá el contenido.
 * Está RECORTADO a mano: solo `Json` y `Database`, y con las listas `Relationships` vacías.
 * Eso alcanza mientras no usemos consultas con tablas embebidas (select("*, categorias(nombre)")).
 * Si algún día las necesitamos, regenerá el archivo completo.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      categorias: {
        Row: { activo: boolean; id: number; nombre: string };
        Insert: { activo?: boolean; id?: never; nombre: string };
        Update: { activo?: boolean; id?: never; nombre?: string };
        Relationships: [];
      };
      costos_producto: {
        Row: {
          costo_centavos: number;
          creado_por: string | null;
          id: number;
          producto_id: number;
          vigente_desde: string;
        };
        Insert: {
          costo_centavos: number;
          creado_por?: string | null;
          id?: never;
          producto_id: number;
          vigente_desde?: string;
        };
        Update: {
          costo_centavos?: number;
          creado_por?: string | null;
          id?: never;
          producto_id?: number;
          vigente_desde?: string;
        };
        Relationships: [];
      };
      gastos_fijos: {
        Row: { activo: boolean; creado_en: string; id: number; monto_centavos: number; nombre: string };
        Insert: { activo?: boolean; creado_en?: string; id?: never; monto_centavos: number; nombre: string };
        Update: { activo?: boolean; creado_en?: string; id?: never; monto_centavos?: number; nombre?: string };
        Relationships: [];
      };
      lotes_stock: {
        Row: {
          cantidad: number;
          costo_total_centavos: number | null;
          creado_en: string;
          id: number;
          movimiento_id: number;
          pagado: boolean;
          pagado_en: string | null;
          pagar_hasta: string | null;
          producto_id: number;
          proveedor_id: number | null;
          vence_el: string | null;
        };
        Insert: {
          cantidad: number;
          costo_total_centavos?: number | null;
          creado_en?: string;
          id?: never;
          movimiento_id: number;
          pagado?: boolean;
          pagado_en?: string | null;
          pagar_hasta?: string | null;
          producto_id: number;
          proveedor_id?: number | null;
          vence_el?: string | null;
        };
        Update: {
          cantidad?: number;
          costo_total_centavos?: number | null;
          creado_en?: string;
          id?: never;
          movimiento_id?: number;
          pagado?: boolean;
          pagado_en?: string | null;
          pagar_hasta?: string | null;
          producto_id?: number;
          proveedor_id?: number | null;
          vence_el?: string | null;
        };
        Relationships: [
          { foreignKeyName: "lotes_stock_producto_id_fkey"; columns: ["producto_id"]; isOneToOne: false; referencedRelation: "productos"; referencedColumns: ["id"] },
          { foreignKeyName: "lotes_stock_proveedor_id_fkey"; columns: ["proveedor_id"]; isOneToOne: false; referencedRelation: "proveedores"; referencedColumns: ["id"] },
        ];
      };
      metas_mensuales: {
        Row: { actualizado_en: string; mes: string; meta_centavos: number };
        Insert: { actualizado_en?: string; mes: string; meta_centavos: number };
        Update: { actualizado_en?: string; mes?: string; meta_centavos?: number };
        Relationships: [];
      };
      proveedores: {
        Row: { activo: boolean; creado_en: string; id: number; nombre: string; telefono: string | null };
        Insert: { activo?: boolean; creado_en?: string; id?: never; nombre: string; telefono?: string | null };
        Update: { activo?: boolean; creado_en?: string; id?: never; nombre?: string; telefono?: string | null };
        Relationships: [];
      };
      movimientos_caja: {
        Row: {
          creado_en: string;
          id: number;
          monto_centavos: number;
          motivo: string;
          tipo: Database["public"]["Enums"]["tipo_mov_caja"];
          turno_id: number;
          usuario_id: string;
        };
        Insert: {
          creado_en?: string;
          id?: never;
          monto_centavos: number;
          motivo: string;
          tipo: Database["public"]["Enums"]["tipo_mov_caja"];
          turno_id: number;
          usuario_id: string;
        };
        Update: {
          creado_en?: string;
          id?: never;
          monto_centavos?: number;
          motivo?: string;
          tipo?: Database["public"]["Enums"]["tipo_mov_caja"];
          turno_id?: number;
          usuario_id?: string;
        };
        Relationships: [];
      };
      movimientos_stock: {
        Row: {
          cantidad: number;
          clave_idempotencia: string | null;
          creado_en: string;
          id: number;
          motivo: string | null;
          producto_id: number;
          tipo: Database["public"]["Enums"]["tipo_mov_stock"];
          usuario_id: string;
          venta_item_id: number | null;
        };
        Insert: {
          cantidad: number;
          clave_idempotencia?: string | null;
          creado_en?: string;
          id?: never;
          motivo?: string | null;
          producto_id: number;
          tipo: Database["public"]["Enums"]["tipo_mov_stock"];
          usuario_id: string;
          venta_item_id?: number | null;
        };
        Update: {
          cantidad?: number;
          clave_idempotencia?: string | null;
          creado_en?: string;
          id?: never;
          motivo?: string | null;
          producto_id?: number;
          tipo?: Database["public"]["Enums"]["tipo_mov_stock"];
          usuario_id?: string;
          venta_item_id?: number | null;
        };
        Relationships: [];
      };
      pagos_venta: {
        Row: {
          id: number;
          medio: Database["public"]["Enums"]["medio_pago"];
          monto_centavos: number;
          venta_id: number;
        };
        Insert: {
          id?: never;
          medio: Database["public"]["Enums"]["medio_pago"];
          monto_centavos: number;
          venta_id: number;
        };
        Update: {
          id?: never;
          medio?: Database["public"]["Enums"]["medio_pago"];
          monto_centavos?: number;
          venta_id?: number;
        };
        Relationships: [];
      };
      perfiles: {
        Row: {
          activo: boolean;
          creado_en: string;
          id: string;
          nombre: string;
          rol: Database["public"]["Enums"]["rol_usuario"];
        };
        Insert: {
          activo?: boolean;
          creado_en?: string;
          id: string;
          nombre: string;
          rol?: Database["public"]["Enums"]["rol_usuario"];
        };
        Update: {
          activo?: boolean;
          creado_en?: string;
          id?: string;
          nombre?: string;
          rol?: Database["public"]["Enums"]["rol_usuario"];
        };
        Relationships: [];
      };
      precios_producto: {
        Row: {
          creado_por: string | null;
          id: number;
          precio_centavos: number;
          producto_id: number;
          vigente_desde: string;
        };
        Insert: {
          creado_por?: string | null;
          id?: never;
          precio_centavos: number;
          producto_id: number;
          vigente_desde?: string;
        };
        Update: {
          creado_por?: string | null;
          id?: never;
          precio_centavos?: number;
          producto_id?: number;
          vigente_desde?: string;
        };
        Relationships: [];
      };
      productos: {
        Row: {
          activo: boolean;
          categoria_id: number;
          codigo: string | null;
          creado_en: string;
          id: number;
          nombre: string;
          stock_minimo: number;
          tipo_venta: Database["public"]["Enums"]["tipo_venta"];
        };
        Insert: {
          activo?: boolean;
          categoria_id: number;
          codigo?: string | null;
          creado_en?: string;
          id?: never;
          nombre: string;
          stock_minimo?: number;
          tipo_venta: Database["public"]["Enums"]["tipo_venta"];
        };
        Update: {
          activo?: boolean;
          categoria_id?: number;
          codigo?: string | null;
          creado_en?: string;
          id?: never;
          nombre?: string;
          stock_minimo?: number;
          tipo_venta?: Database["public"]["Enums"]["tipo_venta"];
        };
        Relationships: [];
      };
      turnos_caja: {
        Row: {
          abierto_en: string;
          abierto_por: string;
          cerrado_en: string | null;
          cerrado_por: string | null;
          efectivo_contado_centavos: number | null;
          efectivo_inicial_centavos: number;
          id: number;
          nota: string | null;
        };
        Insert: {
          abierto_en?: string;
          abierto_por: string;
          cerrado_en?: string | null;
          cerrado_por?: string | null;
          efectivo_contado_centavos?: number | null;
          efectivo_inicial_centavos: number;
          id?: never;
          nota?: string | null;
        };
        Update: {
          abierto_en?: string;
          abierto_por?: string;
          cerrado_en?: string | null;
          cerrado_por?: string | null;
          efectivo_contado_centavos?: number | null;
          efectivo_inicial_centavos?: number;
          id?: never;
          nota?: string | null;
        };
        Relationships: [];
      };
      venta_items: {
        Row: {
          cantidad: number;
          id: number;
          precio_unitario_centavos: number;
          producto_id: number;
          subtotal_centavos: number;
          venta_id: number;
        };
        Insert: {
          cantidad: number;
          id?: never;
          precio_unitario_centavos: number;
          producto_id: number;
          subtotal_centavos: number;
          venta_id: number;
        };
        Update: {
          cantidad?: number;
          id?: never;
          precio_unitario_centavos?: number;
          producto_id?: number;
          subtotal_centavos?: number;
          venta_id?: number;
        };
        Relationships: [];
      };
      ventas: {
        Row: {
          anulada_en: string | null;
          anulada_por: string | null;
          clave_idempotencia: string | null;
          creado_en: string;
          descuento_centavos: number;
          descuento_por: string | null;
          estado: Database["public"]["Enums"]["estado_venta"];
          id: number;
          motivo_anulacion: string | null;
          subtotal_centavos: number;
          total_centavos: number;
          turno_id: number;
          usuario_id: string;
        };
        Insert: {
          anulada_en?: string | null;
          anulada_por?: string | null;
          clave_idempotencia?: string | null;
          creado_en?: string;
          descuento_centavos?: number;
          descuento_por?: string | null;
          estado?: Database["public"]["Enums"]["estado_venta"];
          id?: never;
          motivo_anulacion?: string | null;
          subtotal_centavos?: number;
          total_centavos: number;
          turno_id: number;
          usuario_id: string;
        };
        Update: {
          anulada_en?: string | null;
          anulada_por?: string | null;
          clave_idempotencia?: string | null;
          creado_en?: string;
          descuento_centavos?: number;
          descuento_por?: string | null;
          estado?: Database["public"]["Enums"]["estado_venta"];
          id?: never;
          motivo_anulacion?: string | null;
          subtotal_centavos?: number;
          total_centavos?: number;
          turno_id?: number;
          usuario_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      productos_con_precio: {
        Row: {
          activo: boolean | null;
          categoria_id: number | null;
          codigo: string | null;
          creado_en: string | null;
          id: number | null;
          nombre: string | null;
          precio_centavos: number | null;
          stock_minimo: number | null;
          tipo_venta: Database["public"]["Enums"]["tipo_venta"] | null;
        };
        Relationships: [];
      };
      stock_actual: {
        Row: { producto_id: number | null; stock: number | null };
        Relationships: [];
      };
    };
    Functions: {
      crear_producto: {
        Args: {
          p_categoria_id: number;
          p_codigo: string;
          p_nombre: string;
          p_precio_centavos: number;
          p_tipo_venta: Database["public"]["Enums"]["tipo_venta"];
        };
        Returns: number;
      };
      cerrar_caja: {
        Args: { p_efectivo_contado_centavos: number; p_nota: string; p_turno_id: number };
        Returns: Json;
      };
      es_dueno: { Args: never; Returns: boolean };
      es_personal: { Args: never; Returns: boolean };
      registrar_movimiento_caja: {
        Args: {
          p_monto_centavos: number;
          p_motivo: string;
          p_tipo: Database["public"]["Enums"]["tipo_mov_caja"];
        };
        Returns: number;
      };
      registrar_venta: {
        Args: { p_clave: string; p_descuento_centavos: number; p_items: Json; p_pagos: Json };
        Returns: number;
      };
      resumen_turno: { Args: { p_turno_id: number }; Returns: Json };
      productos_mas_vendidos: {
        Args: { p_desde: string; p_hasta: string; p_limite: number };
        Returns: {
          producto_id: number;
          nombre: string;
          tipo_venta: Database["public"]["Enums"]["tipo_venta"];
          cantidad: number;
          ingresos: number;
        }[];
      };
      registrar_ingreso: {
        Args: {
          p_producto_id: number;
          p_cantidad: number;
          p_nota: string | null;
          p_clave: string;
          p_costo_total_centavos: number | null;
          p_vence_el: string | null;
          p_proveedor_id: number | null;
          p_pagado: boolean;
          p_pagar_hasta: string | null;
        };
        Returns: number;
      };
      registrar_merma: {
        Args: { p_producto_id: number; p_cantidad: number; p_motivo: string; p_clave: string };
        Returns: number;
      };
      cambiar_precios: { Args: { p_cambios: Json }; Returns: number };
      resumen_ganancia: {
        Args: { p_desde: string; p_hasta: string };
        Returns: { ingresos_con_costo: number; costo_vendido: number; ingresos_sin_costo: number; descuentos: number }[];
      };
      margen_por_producto: {
        Args: { p_desde: string; p_hasta: string; p_limite: number };
        Returns: {
          producto_id: number;
          nombre: string;
          tipo_venta: Database["public"]["Enums"]["tipo_venta"];
          cantidad: number;
          ingresos_con_costo: number;
          costo_vendido: number;
          ingresos_sin_costo: number;
        }[];
      };
      mermas_del_periodo: {
        Args: { p_desde: string; p_hasta: string };
        Returns: {
          producto_id: number;
          nombre: string;
          tipo_venta: Database["public"]["Enums"]["tipo_venta"];
          cantidad: number;
          costo_centavos: number;
          sin_costo: number;
        }[];
      };
      vencimientos_proximos: {
        Args: { p_dias: number };
        Returns: {
          lote_id: number;
          producto_id: number;
          nombre: string;
          tipo_venta: Database["public"]["Enums"]["tipo_venta"];
          quedan: number;
          vence_el: string;
          dias_restantes: number;
        }[];
      };
      ventas_por_dia: {
        Args: { p_dias: number };
        Returns: { dia: string; cantidad: number; total: number; descuentos: number }[];
      };
      ventas_por_medio: {
        Args: { p_desde: string; p_hasta: string };
        Returns: { medio: Database["public"]["Enums"]["medio_pago"]; cantidad: number; total: number }[];
      };
    };
    Enums: {
      estado_venta: "completada" | "anulada";
      medio_pago: "efectivo" | "tarjeta" | "transferencia" | "billetera";
      rol_usuario: "dueno" | "cajero";
      tipo_mov_caja: "ingreso" | "retiro" | "gasto";
      tipo_mov_stock: "ingreso" | "venta" | "anulacion_venta" | "merma" | "ajuste";
      tipo_venta: "peso" | "unidad";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
