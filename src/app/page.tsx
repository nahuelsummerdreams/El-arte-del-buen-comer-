import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <Image
        src="/logo.jpg"
        alt="Logo de El Arte del Buen Comer"
        width={754}
        height={765}
        priority
        className="h-56 w-56 rounded-full object-cover shadow-2xl shadow-black/60 sm:h-72 sm:w-72"
      />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Sistema de gestión
        </h1>
        <p className="text-crema/60">Productos · Ventas · Inventario · Caja</p>
      </div>
    </main>
  );
}
