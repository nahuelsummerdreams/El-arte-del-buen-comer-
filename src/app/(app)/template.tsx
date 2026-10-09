// A diferencia del layout, el "template" se vuelve a crear en cada navegación: así cada pantalla
// entra con una suave aparición (ver .fx-pagina en globals.css).
export default function Plantilla({ children }: { children: React.ReactNode }) {
  return <div className="fx-pagina">{children}</div>;
}
