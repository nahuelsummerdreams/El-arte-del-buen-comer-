/**
 * Convierte la respuesta del asistente (texto con un poco de Markdown) en bloques simples que la
 * pantalla dibuja con componentes de React. NUNCA se inserta HTML crudo: lo que escribe el modelo
 * (o lo que venga dentro de un dato) no puede colar etiquetas ni scripts en la página.
 *
 * Se entiende: **negrita**, listas con "- " o "* " o "1. ", y párrafos separados por línea en blanco.
 */

export type Segmento = { texto: string; negrita: boolean };
export type Bloque = { tipo: "parrafo"; lineas: Segmento[][] } | { tipo: "lista"; items: Segmento[][] };

export function segmentar(linea: string): Segmento[] {
  const partes = linea.split("**");
  const resultado: Segmento[] = [];
  partes.forEach((texto, i) => {
    if (texto === "") return;
    // Las partes impares están entre ** **. Si los ** quedaron sin cerrar, la última no es negrita.
    const cerrada = i % 2 === 1 && i < partes.length - 1;
    resultado.push({ texto: cerrada ? texto : i % 2 === 1 ? `**${texto}` : texto, negrita: cerrada });
  });
  return resultado.length > 0 ? resultado : [{ texto: "", negrita: false }];
}

const ES_ITEM = /^\s{0,3}(?:[-*•]|\d{1,2}[.)])\s+(.*)$/;

export function formatearRespuesta(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let lineas: string[] = [];
  const cerrarParrafo = () => {
    if (lineas.length > 0) bloques.push({ tipo: "parrafo", lineas: lineas.map(segmentar) });
    lineas = [];
  };

  for (const cruda of texto.replace(/\r/g, "").split("\n")) {
    const linea = cruda.trimEnd();
    if (linea.trim() === "") {
      cerrarParrafo();
      continue;
    }
    const item = ES_ITEM.exec(linea);
    if (item) {
      cerrarParrafo();
      const ultimo = bloques[bloques.length - 1];
      if (ultimo?.tipo === "lista") ultimo.items.push(segmentar(item[1]));
      else bloques.push({ tipo: "lista", items: [segmentar(item[1])] });
    } else {
      lineas.push(linea.trim().replace(/^#{1,6}\s+/, ""));
    }
  }
  cerrarParrafo();
  return bloques;
}
