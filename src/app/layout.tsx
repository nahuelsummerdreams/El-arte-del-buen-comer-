import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif de títulos: acompaña las letras del logo (el texto del cuerpo sigue en Geist).
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "El Arte del Buen Comer",
  description: "Sistema de gestión: productos, ventas, inventario y caja.",
};

// Se ejecuta ANTES de dibujar la página: lee la elección guardada y la aplica al <html>. Sin esto,
// quien eligió el modo día vería un destello oscuro en cada carga. Por defecto: oscuro (la marca).
const SCRIPT_TEMA = `try{var t=localStorage.getItem("tema");document.documentElement.dataset.tema=t==="claro"?"claro":"oscuro"}catch(e){document.documentElement.dataset.tema="oscuro"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
